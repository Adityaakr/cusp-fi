use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Bs53nqkzB4x81giq2Vc8SC6NLK7euxWThkcuj3UVZZcp");

/// Cusp Earn Vault Program
///
/// Users deposit USDC (frontend swaps USDT → USDC via Jupiter first) and
/// receive cUSDT vault shares at the current exchange rate. As yield accrues
/// from Kamino Steakhouse vault deposits, the exchange rate increases so each
/// cUSDT is worth more USDC over time.
///
/// Exchange rate = vault_usdc_balance / total_cusdt_supply
/// Starting rate: 1 cUSDT = 1 USDC (1,000,000 lamports)
///
/// The vault operator deposits the vault's USDC into Kamino off-chain via
/// the REST API, then calls `sync_yield` to reflect accrued yield as an
/// updated exchange rate (increased USDC balance without minting cUSDT).
#[program]
pub mod cusp_earn_vault {
    use super::*;

    /// Create the earn vault state and cUSDT mint. Called once by admin.
    pub fn initialize(ctx: Context<Initialize>, usdc_mint: Pubkey, usdt_mint: Pubkey) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;
        vault.admin = ctx.accounts.admin.key();
        vault.usdc_mint = usdc_mint;
        vault.usdt_mint = usdt_mint;
        vault.cusdt_mint = ctx.accounts.cusdt_mint.key();
        vault.vault_usdc_account = Pubkey::default();
        vault.total_usdc_balance = 0;
        vault.total_cusdt_supply = 0;
        vault.kamino_shares_value = 0;
        vault.kamino_apy_bps = 0;
        vault.performance_fee_bps = 500; // 5%
        vault.bump = ctx.bumps.vault_state;
        vault.cusdt_mint_bump = ctx.bumps.cusdt_mint;
        vault.is_paused = false;
        vault.seconds_since_epoch = 0;

        msg!("Cusp Earn Vault initialized");
        Ok(())
    }

    /// Create the vault's USDC token account. Called once after initialize.
    pub fn init_vault_account(ctx: Context<InitVaultAccount>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;
        vault.vault_usdc_account = ctx.accounts.vault_usdc_account.key();
        msg!("Vault USDC account created");
        Ok(())
    }

    /// Deposit USDC into the earn vault, receive cUSDT shares.
    /// Frontend should swap USDT → USDC via Jupiter before calling this.
    pub fn deposit(ctx: Context<Deposit>, usdc_amount: u64) -> Result<()> {
        require!(usdc_amount > 0, EarnVaultError::ZeroAmount);
        require!(!ctx.accounts.vault_state.is_paused, EarnVaultError::VaultPaused);

        let vault = &ctx.accounts.vault_state;

        let cusdt_to_mint = if vault.total_cusdt_supply == 0 || vault.total_usdc_balance == 0 {
            usdc_amount
        } else {
            (usdc_amount as u128)
                .checked_mul(vault.total_cusdt_supply as u128)
                .ok_or(EarnVaultError::Overflow)?
                .checked_div(vault.total_usdc_balance as u128)
                .ok_or(EarnVaultError::Overflow)? as u64
        };

        require!(cusdt_to_mint > 0, EarnVaultError::DepositTooSmall);

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

        let vault_seeds = &[b"earn-vault" as &[u8], &[ctx.accounts.vault_state.bump]];
        let signer_seeds = &[&vault_seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.cusdt_mint.to_account_info(),
                    to: ctx.accounts.user_cusdt_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
                signer_seeds,
            ),
            cusdt_to_mint,
        )?;

        let vault = &mut ctx.accounts.vault_state;
        vault.total_usdc_balance = vault
            .total_usdc_balance
            .checked_add(usdc_amount)
            .ok_or(EarnVaultError::Overflow)?;
        vault.total_cusdt_supply = vault
            .total_cusdt_supply
            .checked_add(cusdt_to_mint)
            .ok_or(EarnVaultError::Overflow)?;

        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            usdc_amount,
            cusdt_minted: cusdt_to_mint,
            total_usdc: vault.total_usdc_balance,
            total_cusdt: vault.total_cusdt_supply,
            exchange_rate: vault.exchange_rate_bps(),
        });

        Ok(())
    }

    /// Withdraw USDC from the earn vault by burning cUSDT shares.
    pub fn withdraw(ctx: Context<Withdraw>, cusdt_amount: u64) -> Result<()> {
        require!(cusdt_amount > 0, EarnVaultError::ZeroAmount);
        require!(!ctx.accounts.vault_state.is_paused, EarnVaultError::VaultPaused);

        let vault = &ctx.accounts.vault_state;

        let usdc_to_return = (cusdt_amount as u128)
            .checked_mul(vault.total_usdc_balance as u128)
            .ok_or(EarnVaultError::Overflow)?
            .checked_div(vault.total_cusdt_supply as u128)
            .ok_or(EarnVaultError::Overflow)? as u64;

        require!(usdc_to_return > 0, EarnVaultError::WithdrawTooSmall);

        let vault_usdc_balance = ctx.accounts.vault_usdc_account.amount;
        require!(
            usdc_to_return <= vault_usdc_balance,
            EarnVaultError::InsufficientLiquidity
        );

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.cusdt_mint.to_account_info(),
                    from: ctx.accounts.user_cusdt_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cusdt_amount,
        )?;

        let vault_seeds = &[b"earn-vault" as &[u8], &[ctx.accounts.vault_state.bump]];
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

        let vault = &mut ctx.accounts.vault_state;
        vault.total_usdc_balance = vault
            .total_usdc_balance
            .checked_sub(usdc_to_return)
            .ok_or(EarnVaultError::Overflow)?;
        vault.total_cusdt_supply = vault
            .total_cusdt_supply
            .checked_sub(cusdt_amount)
            .ok_or(EarnVaultError::Overflow)?;

        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            usdc_returned: usdc_to_return,
            cusdt_burned: cusdt_amount,
            total_usdc: vault.total_usdc_balance,
            total_cusdt: vault.total_cusdt_supply,
            exchange_rate: vault.exchange_rate_bps(),
        });

        Ok(())
    }

    /// Sync yield from Kamino vault into the earn vault state.
    /// Called by the crank/operator after withdrawing from Kamino off-chain
    /// and depositing the yield USDC into the vault's token account.
    ///
    /// This instruction does NOT transfer any tokens — it only updates
    /// `total_usdc_balance` to match the actual on-chain balance, which
    /// increases the exchange rate for all cUSDT holders.
    ///
    /// The operator must first:
    ///   1. Withdraw from Kamino (or read kUSDC share value)
    ///   2. Transfer the yield USDC into vault_usdc_account
    ///   3. Call sync_yield to update the bookkeeping
    pub fn sync_yield(ctx: Context<SyncYield>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;

        let actual_balance = ctx.accounts.vault_usdc_account.amount;

        if actual_balance > vault.total_usdc_balance {
            let yield_added = actual_balance
                .checked_sub(vault.total_usdc_balance)
                .ok_or(EarnVaultError::Overflow)?;

            vault.total_usdc_balance = actual_balance;

            emit!(YieldSyncEvent {
                yield_added,
                total_usdc: vault.total_usdc_balance,
                total_cusdt: vault.total_cusdt_supply,
                exchange_rate: vault.exchange_rate_bps(),
            });
        } else {
            vault.total_usdc_balance = actual_balance;
        }

        vault.seconds_since_epoch = Clock::get()?.unix_timestamp as u64;

        msg!(
            "Yield synced. Balance: {}, Supply: {}, Rate: {} bps",
            vault.total_usdc_balance,
            vault.total_cusdt_supply,
            vault.exchange_rate_bps()
        );

        Ok(())
    }

    /// Update the Kamino APY for frontend display. Admin only (crank).
    pub fn update_kamino_apy(ctx: Context<AdminAction>, apy_bps: u64) -> Result<()> {
        ctx.accounts.vault_state.kamino_apy_bps = apy_bps;
        msg!("Kamino APY updated to {} bps ({}%)", apy_bps, apy_bps as f64 / 100.0);
        Ok(())
    }

    /// Pause or unpause the vault. Admin only.
    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        ctx.accounts.vault_state.is_paused = paused;
        msg!("Earn vault paused: {}", paused);
        Ok(())
    }

    /// Update performance fee. Admin only.
    pub fn set_performance_fee(ctx: Context<AdminAction>, fee_bps: u64) -> Result<()> {
        require!(fee_bps <= 1000, EarnVaultError::FeeTooHigh);
        ctx.accounts.vault_state.performance_fee_bps = fee_bps;
        msg!("Performance fee updated to {} bps", fee_bps);
        Ok(())
    }
}

// ── State ─────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    /// Admin authority — can call admin-only instructions
    pub admin: Pubkey,
    /// USDC mint (mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
    pub usdc_mint: Pubkey,
    /// USDT mint (mainnet: Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q)
    pub usdt_mint: Pubkey,
    /// cUSDT mint — PDA owned by the vault
    pub cusdt_mint: Pubkey,
    /// Vault's USDC token account (PDA)
    pub vault_usdc_account: Pubkey,
    /// Total USDC balance managed by the vault (lamports, 6 decimals)
    /// This tracks the book value; actual on-chain balance may differ due to
    /// yield accrual (synced via sync_yield)
    pub total_usdc_balance: u64,
    /// Total cUSDT supply (lamports, 6 decimals)
    pub total_cusdt_supply: u64,
    /// Value of the vault's kUSDC shares in USDC (lamports)
    /// Updated via sync_yield; used for frontend display
    pub kamino_shares_value: u64,
    /// Current Kamino APY in basis points (e.g. 426 = 4.26%)
    /// Updated by the operator/crank
    pub kamino_apy_bps: u64,
    /// Performance fee in basis points (default: 500 = 5%)
    pub performance_fee_bps: u64,
    /// PDA bump seed
    pub bump: u8,
    /// cUSDT mint PDA bump seed
    pub cusdt_mint_bump: u8,
    /// Whether the vault is paused (no deposits or withdrawals)
    pub is_paused: bool,
    /// Unix timestamp of last yield sync (for frontend display)
    pub seconds_since_epoch: u64,
}

impl VaultState {
    /// Exchange rate in basis points: (total_usdc_balance * 10000) / total_cusdt_supply
    /// Rate of 10000 = 1.0 (each cUSDT = 1 USDC)
    /// Rate of 10426 = 1.0426 (each cUSDT = 1.0426 USDC, ~4.26% yield)
    pub fn exchange_rate_bps(&self) -> u64 {
        if self.total_cusdt_supply == 0 {
            10000 // 1.0 at initialization
        } else {
            (self.total_usdc_balance as u128)
                .checked_mul(10000)
                .unwrap()
                .checked_div(self.total_cusdt_supply as u128)
                .unwrap() as u64
        }
    }
}

// ── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"earn-vault"],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = admin,
        mint::decimals = 6,
        mint::authority = vault_state,
        seeds = [b"cusdt-mint"],
        bump,
    )]
    pub cusdt_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitVaultAccount<'info> {
    #[account(mut, address = vault_state.admin @ EarnVaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"earn-vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = vault_state,
        seeds = [b"earn-vault-usdc"],
        bump,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

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
        seeds = [b"earn-vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.cusdt_mint,
    )]
    pub cusdt_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.usdc_mint, token::authority = user)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.cusdt_mint)]
    pub user_cusdt_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"earn-vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.cusdt_mint,
    )]
    pub cusdt_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.usdc_mint, token::authority = user)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault_state.cusdt_mint, token::authority = user)]
    pub user_cusdt_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SyncYield<'info> {
    #[account(mut, address = vault_state.admin @ EarnVaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"earn-vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.vault_usdc_account,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(address = vault_state.admin @ EarnVaultError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"earn-vault"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,
}

// ── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub usdc_amount: u64,
    pub cusdt_minted: u64,
    pub total_usdc: u64,
    pub total_cusdt: u64,
    pub exchange_rate: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub usdc_returned: u64,
    pub cusdt_burned: u64,
    pub total_usdc: u64,
    pub total_cusdt: u64,
    pub exchange_rate: u64,
}

#[event]
pub struct YieldSyncEvent {
    pub yield_added: u64,
    pub total_usdc: u64,
    pub total_cusdt: u64,
    pub exchange_rate: u64,
}

// ── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum EarnVaultError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Deposit too small to mint any cUSDT")]
    DepositTooSmall,
    #[msg("Withdraw too small to return any USDC")]
    WithdrawTooSmall,
    #[msg("Insufficient vault liquidity for withdrawal")]
    InsufficientLiquidity,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Fee exceeds 10% (1000 bps)")]
    FeeTooHigh,
}