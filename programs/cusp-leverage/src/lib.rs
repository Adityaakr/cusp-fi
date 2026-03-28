use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Duyqj2n1CxiVhCN4fgNFf8dbtSeyrZVE3XCBtG6VUgx9");

/// Cusp Leverage Program
///
/// Manages leveraged positions on prediction markets.
/// Users post collateral (USDC), borrow from the vault, and the total amount
/// is used to buy outcome tokens via DFlow.
///
/// Position lifecycle:
/// 1. open_position  — user posts margin, protocol records leverage params on-chain
/// 2. fill_position  — cranker/admin records the outcome tokens received (after DFlow trade)
/// 3. close_position — sells outcome tokens, repays borrowed amount, returns profit/loss
/// 4. liquidate      — if collateral ratio drops below threshold, anyone can liquidate
#[program]
pub mod cusp_leverage {
    use super::*;

    /// Initialize the leverage protocol. Called once by admin.
    pub fn initialize(ctx: Context<InitializeProtocol>, max_leverage: u16) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.admin = ctx.accounts.admin.key();
        protocol.usdc_mint = ctx.accounts.usdc_mint.key();
        protocol.max_leverage = max_leverage; // e.g. 300 = 3x
        protocol.liquidation_threshold = 80; // liquidate when collateral drops to 80% of borrowed
        protocol.total_positions = 0;
        protocol.total_open_positions = 0;
        protocol.total_volume = 0;
        protocol.bump = ctx.bumps.protocol_state;
        protocol.is_paused = false;

        msg!("Leverage protocol initialized, max leverage: {}x", max_leverage as f64 / 100.0);
        Ok(())
    }

    /// Open a leveraged position. User posts collateral USDC.
    /// The cranker/backend will execute the DFlow trade and call fill_position.
    pub fn open_position(
        ctx: Context<OpenPosition>,
        margin_usdc: u64,
        leverage_bps: u16, // 100 = 1x, 200 = 2x, 300 = 3x
        market_ticker: [u8; 32], // padded market ticker
        side: Side,
    ) -> Result<()> {
        let protocol = &ctx.accounts.protocol_state;
        require!(!protocol.is_paused, LeverageError::ProtocolPaused);
        require!(margin_usdc >= 1_000_000, LeverageError::MarginTooLow); // min 1 USDC
        require!(leverage_bps >= 100 && leverage_bps <= protocol.max_leverage, LeverageError::InvalidLeverage);

        let total_usdc = (margin_usdc as u128)
            .checked_mul(leverage_bps as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;
        let borrowed_usdc = total_usdc.checked_sub(margin_usdc).unwrap();

        // Transfer margin USDC from user to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_account.to_account_info(),
                    to: ctx.accounts.position_escrow.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            margin_usdc,
        )?;

        // Record position on-chain
        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.user.key();
        position.market_ticker = market_ticker;
        position.side = side;
        position.margin_usdc = margin_usdc;
        position.borrowed_usdc = borrowed_usdc;
        position.total_usdc = total_usdc;
        position.leverage_bps = leverage_bps;
        position.outcome_tokens = 0; // filled by cranker
        position.entry_price_bps = 0; // filled by cranker
        position.status = PositionStatus::Pending;
        position.opened_at = Clock::get()?.unix_timestamp;
        position.closed_at = 0;
        position.bump = ctx.bumps.position;
        position.escrow_bump = ctx.bumps.position_escrow;
        position.position_id = ctx.accounts.protocol_state.total_positions;

        // Update protocol stats
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.total_positions = protocol.total_positions.checked_add(1).unwrap();
        protocol.total_open_positions = protocol.total_open_positions.checked_add(1).unwrap();
        protocol.total_volume = protocol.total_volume.checked_add(total_usdc).unwrap();

        msg!(
            "Position #{} opened: {} USDC margin, {}x leverage, {} total",
            position.position_id,
            margin_usdc,
            leverage_bps as f64 / 100.0,
            total_usdc
        );

        emit!(PositionOpenedEvent {
            position_id: position.position_id,
            owner: position.owner,
            margin_usdc,
            borrowed_usdc,
            total_usdc,
            leverage_bps,
            side,
        });

        Ok(())
    }

    /// Fill a pending position with outcome token details after DFlow trade.
    /// Called by admin/cranker after executing the off-chain trade.
    pub fn fill_position(
        ctx: Context<FillPosition>,
        outcome_tokens: u64,
        entry_price_bps: u16, // price in basis points, e.g. 7500 = $0.75
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require!(position.status == PositionStatus::Pending, LeverageError::InvalidPositionStatus);

        position.outcome_tokens = outcome_tokens;
        position.entry_price_bps = entry_price_bps;
        position.status = PositionStatus::Open;

        msg!(
            "Position #{} filled: {} tokens at {} bps",
            position.position_id,
            outcome_tokens,
            entry_price_bps
        );

        emit!(PositionFilledEvent {
            position_id: position.position_id,
            outcome_tokens,
            entry_price_bps,
        });

        Ok(())
    }

    /// Close a position. Returns margin + profit (or margin - loss) to user.
    /// Called by admin/cranker after selling outcome tokens via DFlow.
    pub fn close_position(
        ctx: Context<ClosePosition>,
        usdc_received: u64, // USDC received from selling outcome tokens
    ) -> Result<()> {
        let position = &ctx.accounts.position;
        require!(
            position.status == PositionStatus::Open,
            LeverageError::InvalidPositionStatus
        );

        // Calculate P&L
        let repay_amount = position.borrowed_usdc;
        let user_return = if usdc_received > repay_amount {
            usdc_received.checked_sub(repay_amount).unwrap()
        } else {
            // Loss exceeds borrowed — user gets back whatever is left from margin
            let loss = repay_amount.checked_sub(usdc_received).unwrap();
            position.margin_usdc.saturating_sub(loss)
        };

        // Transfer remaining USDC to user from escrow
        if user_return > 0 {
            let position_id_bytes = position.position_id.to_le_bytes();
            let escrow_seeds = &[
                b"escrow" as &[u8],
                ctx.accounts.position.owner.as_ref(),
                &position_id_bytes,
                &[position.escrow_bump],
            ];
            let signer_seeds = &[&escrow_seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.position_escrow.to_account_info(),
                        to: ctx.accounts.user_usdc_account.to_account_info(),
                        authority: ctx.accounts.position_escrow.to_account_info(),
                    },
                    signer_seeds,
                ),
                user_return,
            )?;
        }

        // Update position
        let position = &mut ctx.accounts.position;
        position.status = PositionStatus::Closed;
        position.closed_at = Clock::get()?.unix_timestamp;

        // Update protocol stats
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.total_open_positions = protocol.total_open_positions.saturating_sub(1);

        let pnl = usdc_received as i64 - position.total_usdc as i64;
        msg!(
            "Position #{} closed. Received: {}, Return to user: {}, PnL: {}",
            position.position_id,
            usdc_received,
            user_return,
            pnl
        );

        emit!(PositionClosedEvent {
            position_id: position.position_id,
            owner: position.owner,
            usdc_received,
            user_return,
            pnl,
        });

        Ok(())
    }

    /// Liquidate an undercollateralized position. Can be called by anyone.
    pub fn liquidate(
        ctx: Context<Liquidate>,
        current_price_bps: u16, // current market price in basis points
    ) -> Result<()> {
        let position = &ctx.accounts.position;
        require!(position.status == PositionStatus::Open, LeverageError::InvalidPositionStatus);

        // Calculate current position value
        let current_value = (position.outcome_tokens as u128)
            .checked_mul(current_price_bps as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        // Position is liquidatable if current value < borrowed * liquidation_threshold / 100
        let liquidation_value = (position.borrowed_usdc as u128)
            .checked_mul(ctx.accounts.protocol_state.liquidation_threshold as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;

        require!(current_value <= liquidation_value, LeverageError::NotLiquidatable);

        // Mark as liquidated
        let position = &mut ctx.accounts.position;
        position.status = PositionStatus::Liquidated;
        position.closed_at = Clock::get()?.unix_timestamp;

        let protocol = &mut ctx.accounts.protocol_state;
        protocol.total_open_positions = protocol.total_open_positions.saturating_sub(1);

        msg!("Position #{} liquidated at price {} bps", position.position_id, current_price_bps);

        emit!(LiquidationEvent {
            position_id: position.position_id,
            owner: position.owner,
            current_price_bps,
            liquidator: ctx.accounts.liquidator.key(),
        });

        Ok(())
    }

    /// Pause/unpause the protocol. Admin only.
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.protocol_state.is_paused = paused;
        msg!("Protocol paused: {}", paused);
        Ok(())
    }
}

// ── State ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Side {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PositionStatus {
    Pending,    // margin posted, awaiting DFlow trade fill
    Open,       // trade filled, position is live
    Closed,     // user closed the position
    Liquidated, // position was liquidated
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub max_leverage: u16,        // in basis points: 300 = 3x
    pub liquidation_threshold: u8, // percent: 80 = liquidate at 80%
    pub total_positions: u64,
    pub total_open_positions: u64,
    pub total_volume: u64,
    pub bump: u8,
    pub is_paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub market_ticker: [u8; 32],
    pub side: Side,
    pub margin_usdc: u64,
    pub borrowed_usdc: u64,
    pub total_usdc: u64,
    pub leverage_bps: u16,
    pub outcome_tokens: u64,
    pub entry_price_bps: u16,
    pub status: PositionStatus,
    pub opened_at: i64,
    pub closed_at: i64,
    pub bump: u8,
    pub escrow_bump: u8,
    pub position_id: u64,
}

// ── Account Contexts ─────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol"],
        bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Box<Account<'info, ProtocolState>>,

    #[account(
        init,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", user.key().as_ref(), &protocol_state.total_positions.to_le_bytes()],
        bump,
    )]
    pub position: Box<Account<'info, Position>>,

    /// Escrow to hold margin USDC for this position
    #[account(
        init,
        payer = user,
        token::mint = usdc_mint,
        token::authority = position_escrow, // self-authority PDA
        seeds = [b"escrow", user.key().as_ref(), &protocol_state.total_positions.to_le_bytes()],
        bump,
    )]
    pub position_escrow: Box<Account<'info, TokenAccount>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, token::mint = usdc_mint, token::authority = user)]
    pub user_usdc_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FillPosition<'info> {
    #[account(address = protocol_state.admin @ LeverageError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(seeds = [b"protocol"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"position", position.owner.as_ref(), &position.position_id.to_le_bytes()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(address = protocol_state.admin @ LeverageError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"position", position.owner.as_ref(), &position.position_id.to_le_bytes()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,

    /// CHECK: Validated by position.owner
    #[account(address = position.owner)]
    pub position_owner: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", position.owner.as_ref(), &position.position_id.to_le_bytes()],
        bump = position.escrow_bump,
    )]
    pub position_escrow: Account<'info, TokenAccount>,

    #[account(mut, token::mint = protocol_state.usdc_mint)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"position", position.owner.as_ref(), &position.position_id.to_le_bytes()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(address = protocol_state.admin @ LeverageError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
}

// ── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct PositionOpenedEvent {
    pub position_id: u64,
    pub owner: Pubkey,
    pub margin_usdc: u64,
    pub borrowed_usdc: u64,
    pub total_usdc: u64,
    pub leverage_bps: u16,
    pub side: Side,
}

#[event]
pub struct PositionFilledEvent {
    pub position_id: u64,
    pub outcome_tokens: u64,
    pub entry_price_bps: u16,
}

#[event]
pub struct PositionClosedEvent {
    pub position_id: u64,
    pub owner: Pubkey,
    pub usdc_received: u64,
    pub user_return: u64,
    pub pnl: i64,
}

#[event]
pub struct LiquidationEvent {
    pub position_id: u64,
    pub owner: Pubkey,
    pub current_price_bps: u16,
    pub liquidator: Pubkey,
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum LeverageError {
    #[msg("Margin must be at least 1 USDC")]
    MarginTooLow,
    #[msg("Leverage must be between 1x and max")]
    InvalidLeverage,
    #[msg("Invalid position status for this operation")]
    InvalidPositionStatus,
    #[msg("Position is not liquidatable")]
    NotLiquidatable,
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Unauthorized")]
    Unauthorized,
}
