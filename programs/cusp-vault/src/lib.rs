use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ");

/// Cusp Vault Program
///
/// Users deposit USDC and receive cUSDC (vault shares) at the current exchange rate.
/// When yield accrues (from leveraged trading profits), the exchange rate increases,
/// meaning each cUSDC is worth more USDC over time.
///
/// Exchange rate = total_usdc_managed / total_cusdc_supply
/// Starting rate: 1 cUSDC = 1 USDC
///
/// The vault also acts as a lending pool for leveraged trades:
/// - `deploy_funds`: admin withdraws USDC to fund a leveraged DFlow trade
/// - `return_funds`: admin returns borrowed principal after trade closes
/// - `add_yield`: admin deposits trading profit (increases cUSDC exchange rate)
#[program]
pub mod cusp_vault {
    use super::*;

    /// Step 1: Create vault state and cUSDC mint. Called once by admin.
    pub fn initialize(ctx: Context<Initialize>, usdc_mint: Pubkey) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;
        vault.admin = ctx.accounts.admin.key();
        vault.usdc_mint = usdc_mint;
        vault.cusdc_mint = ctx.accounts.cusdc_mint.key();
        vault.vault_usdc_account = Pubkey::default(); // set in init_vault_account
        vault.total_usdc_managed = 0;
        vault.total_cusdc_supply = 0;
        vault.total_deployed = 0;
        vault.bump = ctx.bumps.vault_state;
        vault.cusdc_mint_bump = ctx.bumps.cusdc_mint;
        vault.is_paused = false;

        msg!("Vault state + cUSDC mint created");
        Ok(())
    }

    /// Step 2: Create the vault's USDC token account. Called once after initialize.
    pub fn init_vault_account(ctx: Context<InitVaultAccount>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;
        vault.vault_usdc_account = ctx.accounts.vault_usdc_account.key();
        msg!("Vault USDC account created");
        Ok(())
    }

    /// Deposit USDC into the vault, receive cUSDC shares.
    pub fn deposit(ctx: Context<Deposit>, usdc_amount: u64) -> Result<()> {
        require!(usdc_amount > 0, VaultError::ZeroAmount);
        require!(!ctx.accounts.vault_state.is_paused, VaultError::VaultPaused);

        let vault = &ctx.accounts.vault_state;

        // Calculate cUSDC to mint based on exchange rate
        let cusdc_to_mint = if vault.total_cusdc_supply == 0 || vault.total_usdc_managed == 0 {
            // First deposit: 1:1 ratio
            usdc_amount
        } else {
            // cusdc_to_mint = usdc_amount * total_cusdc_supply / total_usdc_managed
            (usdc_amount as u128)
                .checked_mul(vault.total_cusdc_supply as u128)
                .unwrap()
                .checked_div(vault.total_usdc_managed as u128)
                .unwrap() as u64
        };

        require!(cusdc_to_mint > 0, VaultError::DepositTooSmall);

        // Transfer USDC from user to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_account.to_account_info(),
                    to: ctx.accounts.vault_usdc_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Mint cUSDC to user
        let vault_seeds = &[b"vault" as &[u8], &[ctx.accounts.vault_state.bump]];
        let signer_seeds = &[&vault_seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.cusdc_mint.to_account_info(),
                    to: ctx.accounts.user_cusdc_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
                signer_seeds,
            ),
            cusdc_to_mint,
        )?;

        // Update vault state
        let vault = &mut ctx.accounts.vault_state;
        vault.total_usdc_managed = vault
            .total_usdc_managed
            .checked_add(usdc_amount)
            .ok_or(VaultError::Overflow)?;
        vault.total_cusdc_supply = vault
            .total_cusdc_supply
            .checked_add(cusdc_to_mint)
            .ok_or(VaultError::Overflow)?;

        msg!(
            "Deposited {} USDC, minted {} cUSDC. Rate: {}/{}",
            usdc_amount,
            cusdc_to_mint,
            vault.total_usdc_managed,
            vault.total_cusdc_supply
        );

        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            usdc_amount,
            cusdc_minted: cusdc_to_mint,
            total_usdc: vault.total_usdc_managed,
            total_cusdc: vault.total_cusdc_supply,
        });

        Ok(())
    }

    /// Withdraw USDC from the vault by burning cUSDC shares.
    /// Only available (non-deployed) USDC can be withdrawn.
    pub fn withdraw(ctx: Context<Withdraw>, cusdc_amount: u64) -> Result<()> {
        require!(cusdc_amount > 0, VaultError::ZeroAmount);
        require!(!ctx.accounts.vault_state.is_paused, VaultError::VaultPaused);

        let vault = &ctx.accounts.vault_state;

        // Calculate USDC to return based on exchange rate
        let usdc_to_return = (cusdc_amount as u128)
            .checked_mul(vault.total_usdc_managed as u128)
            .unwrap()
            .checked_div(vault.total_cusdc_supply as u128)
            .unwrap() as u64;

        require!(usdc_to_return > 0, VaultError::WithdrawTooSmall);

        // Check available (non-deployed) balance
        let available = vault
            .total_usdc_managed
            .saturating_sub(vault.total_deployed);
        require!(
            usdc_to_return <= available,
            VaultError::InsufficientVaultFunds
        );

        // Burn cUSDC from user
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.cusdc_mint.to_account_info(),
                    from: ctx.accounts.user_cusdc_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cusdc_amount,
        )?;

        // Transfer USDC from vault to user
        let vault_seeds = &[b"vault" as &[u8], &[ctx.accounts.vault_state.bump]];
        let signer_seeds = &[&vault_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.user_usdc_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
                signer_seeds,
            ),
            usdc_to_return,
        )?;

        // Update vault state
        let vault = &mut ctx.accounts.vault_state;
        vault.total_usdc_managed = vault
            .total_usdc_managed
            .checked_sub(usdc_to_return)
            .ok_or(VaultError::Overflow)?;
        vault.total_cusdc_supply = vault
            .total_cusdc_supply
            .checked_sub(cusdc_amount)
            .ok_or(VaultError::Overflow)?;

        msg!(
            "Withdrew {} USDC, burned {} cUSDC. Rate: {}/{}",
            usdc_to_return,
            cusdc_amount,
            vault.total_usdc_managed,
            vault.total_cusdc_supply
        );

        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            usdc_returned: usdc_to_return,
            cusdc_burned: cusdc_amount,
            total_usdc: vault.total_usdc_managed,
            total_cusdc: vault.total_cusdc_supply,
        });

        Ok(())
    }

    /// Deploy USDC from vault to fund a leveraged trade. Admin only.
    /// The borrowed USDC is sent to a destination account (e.g., position escrow
    /// or admin's trade account) and tracked as deployed capital.
    pub fn deploy_funds(ctx: Context<DeployFunds>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let vault = &ctx.accounts.vault_state;
        let available = vault
            .total_usdc_managed
            .saturating_sub(vault.total_deployed);
        require!(amount <= available, VaultError::InsufficientVaultFunds);

        // Enforce minimum 20% reserve after deployment
        let remaining = available.checked_sub(amount).unwrap();
        let min_reserve = vault.total_usdc_managed / 5; // 20%
        require!(
            remaining >= min_reserve || vault.total_usdc_managed <= 1_000_000, // skip reserve check for tiny vaults (<$1)
            VaultError::ReserveTooLow
        );

        // Transfer USDC from vault to destination
        let vault_seeds = &[b"vault" as &[u8], &[vault.bump]];
        let signer_seeds = &[&vault_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Track deployed capital (total_usdc_managed stays the same — value is still managed)
        let vault = &mut ctx.accounts.vault_state;
        vault.total_deployed = vault
            .total_deployed
            .checked_add(amount)
            .ok_or(VaultError::Overflow)?;

        msg!(
            "Deployed {} USDC. Total deployed: {}, Available: {}",
            amount,
            vault.total_deployed,
            vault.total_usdc_managed.saturating_sub(vault.total_deployed)
        );

        emit!(DeployEvent {
            amount,
            total_deployed: vault.total_deployed,
            total_managed: vault.total_usdc_managed,
        });

        Ok(())
    }

    /// Return borrowed USDC principal back to vault after a leveraged trade closes.
    /// Admin only. Profit should be added separately via add_yield.
    pub fn return_funds(ctx: Context<ReturnFunds>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        require!(
            amount <= ctx.accounts.vault_state.total_deployed,
            VaultError::ReturnExceedsDeployed
        );

        // Transfer USDC back to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source.to_account_info(),
                    to: ctx.accounts.vault_usdc_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;

        // Decrease deployed tracking
        let vault = &mut ctx.accounts.vault_state;
        vault.total_deployed = vault
            .total_deployed
            .checked_sub(amount)
            .ok_or(VaultError::Overflow)?;

        msg!(
            "Returned {} USDC. Total deployed: {}, Available: {}",
            amount,
            vault.total_deployed,
            vault.total_usdc_managed.saturating_sub(vault.total_deployed)
        );

        emit!(ReturnEvent {
            amount,
            total_deployed: vault.total_deployed,
            total_managed: vault.total_usdc_managed,
        });

        Ok(())
    }

    /// Add yield to the vault (increases exchange rate). Admin only.
    /// Called when leveraged trading profits are realized.
    pub fn add_yield(ctx: Context<AddYield>, usdc_amount: u64) -> Result<()> {
        require!(usdc_amount > 0, VaultError::ZeroAmount);

        // Transfer yield USDC into vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_usdc_account.to_account_info(),
                    to: ctx.accounts.vault_usdc_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Increase total_usdc_managed WITHOUT minting new cUSDC
        // This raises the exchange rate for all cUSDC holders
        let vault = &mut ctx.accounts.vault_state;
        vault.total_usdc_managed = vault
            .total_usdc_managed
            .checked_add(usdc_amount)
            .ok_or(VaultError::Overflow)?;

        msg!(
            "Added {} USDC yield. New rate: {}/{}",
            usdc_amount,
            vault.total_usdc_managed,
            vault.total_cusdc_supply
        );

        emit!(YieldEvent {
            usdc_added: usdc_amount,
            total_usdc: vault.total_usdc_managed,
            total_cusdc: vault.total_cusdc_supply,
        });

        Ok(())
    }

    /// Pause/unpause the vault. Admin only.
    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        ctx.accounts.vault_state.is_paused = paused;
        msg!("Vault paused: {}", paused);
        Ok(())
    }
}

// ── Accounts ─────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub cusdc_mint: Pubkey,
    pub vault_usdc_account: Pubkey,
    pub total_usdc_managed: u64,
    pub total_cusdc_supply: u64,
    /// USDC currently deployed to leveraged trades (not available for withdrawal)
    pub total_deployed: u64,
    pub bump: u8,
    pub cusdc_mint_bump: u8,
    pub is_paused: bool,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"vault"],
        bump,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,

    /// cUSDC mint — PDA owned by the vault
    #[account(
        init,
        payer = admin,
        mint::decimals = 6,
        mint::authority = vault_state,
        seeds = [b"cusdc-mint"],
        bump,
    )]
    pub cusdc_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitVaultAccount<'info> {
    #[account(mut, address = vault_state.admin @ VaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,

    /// The USDC mint
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// Vault's USDC token account
    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = vault_state,
        seeds = [b"vault-usdc"],
        bump,
    )]
    pub vault_usdc_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.cusdc_mint,
    )]
    pub cusdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    /// User's USDC token account
    #[account(mut, token::mint = vault_state.usdc_mint, token::authority = user)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    /// User's cUSDC token account
    #[account(mut, token::mint = vault_state.cusdc_mint)]
    pub user_cusdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.cusdc_mint,
    )]
    pub cusdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.usdc_mint, token::authority = user)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.cusdc_mint, token::authority = user)]
    pub user_cusdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DeployFunds<'info> {
    #[account(mut, address = vault_state.admin @ VaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    /// Destination for deployed USDC (e.g., admin's trade account or position escrow)
    #[account(mut, token::mint = vault_state.usdc_mint)]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReturnFunds<'info> {
    #[account(mut, address = vault_state.admin @ VaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    /// Source of returned USDC (admin's account holding the principal)
    #[account(mut, token::mint = vault_state.usdc_mint, token::authority = admin)]
    pub source: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddYield<'info> {
    #[account(mut, address = vault_state.admin @ VaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.usdc_mint, token::authority = admin)]
    pub admin_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(address = vault_state.admin @ VaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,
}

// ── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub usdc_amount: u64,
    pub cusdc_minted: u64,
    pub total_usdc: u64,
    pub total_cusdc: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub usdc_returned: u64,
    pub cusdc_burned: u64,
    pub total_usdc: u64,
    pub total_cusdc: u64,
}

#[event]
pub struct YieldEvent {
    pub usdc_added: u64,
    pub total_usdc: u64,
    pub total_cusdc: u64,
}

#[event]
pub struct DeployEvent {
    pub amount: u64,
    pub total_deployed: u64,
    pub total_managed: u64,
}

#[event]
pub struct ReturnEvent {
    pub amount: u64,
    pub total_deployed: u64,
    pub total_managed: u64,
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum VaultError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Deposit too small to mint any cUSDC")]
    DepositTooSmall,
    #[msg("Withdraw too small to return any USDC")]
    WithdrawTooSmall,
    #[msg("Insufficient USDC in vault")]
    InsufficientVaultFunds,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Deployment would leave reserve below 20%")]
    ReserveTooLow,
    #[msg("Return amount exceeds total deployed")]
    ReturnExceedsDeployed,
}
