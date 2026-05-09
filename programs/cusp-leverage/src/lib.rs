use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    hash::hash,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_token::instruction as token_instruction;
use spl_token::state::{Account as TokenAccount, Mint};

solana_program::declare_id!("HTPcC7PNEGG3w6Tj5VSR9HQTQhELqqQRxKTiWkDUm6uF");

const PROTOCOL_SEED: &[u8] = b"protocol";
const POSITION_SEED: &[u8] = b"position";
const ESCROW_SEED: &[u8] = b"escrow";
const DISC_LEN: usize = 8;
const PROTOCOL_STATE_SPACE: usize = DISC_LEN + 32 + 32 + 2 + 1 + 8 + 8 + 8 + 1 + 1;
const POSITION_SPACE: usize = DISC_LEN + 32 + 32 + 1 + 8 + 8 + 8 + 2 + 8 + 2 + 1 + 8 + 8 + 1 + 1 + 8;

entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PositionStatus {
    Pending,
    Open,
    Closed,
    Liquidated,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProtocolState {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub max_leverage: u16,
    pub liquidation_threshold: u8,
    pub total_positions: u64,
    pub total_open_positions: u64,
    pub total_volume: u64,
    pub bump: u8,
    pub is_paused: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
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

#[derive(BorshSerialize, BorshDeserialize)]
struct InitializeArgs {
    max_leverage: u16,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct OpenPositionArgs {
    margin_usdc: u64,
    leverage_bps: u16,
    market_ticker: [u8; 32],
    side: Side,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct FillPositionArgs {
    outcome_tokens: u64,
    entry_price_bps: u16,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct ClosePositionArgs {
    usdc_received: u64,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct LiquidateArgs {
    current_price_bps: u16,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct SetPausedArgs {
    paused: bool,
}

#[repr(u32)]
enum LeverageError {
    MarginTooLow = 1,
    InvalidLeverage = 2,
    InvalidPositionStatus = 3,
    NotLiquidatable = 4,
    ProtocolPaused = 5,
    Unauthorized = 6,
    InvalidInstruction = 7,
    InvalidAccount = 8,
    Overflow = 9,
}

impl From<LeverageError> for ProgramError {
    fn from(value: LeverageError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() < 8 {
        return Err(LeverageError::InvalidInstruction.into());
    }
    let discriminator: [u8; 8] = instruction_data[..8]
        .try_into()
        .map_err(|_| LeverageError::InvalidInstruction)?;
    let payload = &instruction_data[8..];

    if discriminator == legacy_instruction_discriminator("initialize") {
        let args = InitializeArgs::try_from_slice(payload).map_err(|_| LeverageError::InvalidInstruction)?;
        return initialize(program_id, accounts, args.max_leverage);
    }
    if discriminator == legacy_instruction_discriminator("open_position") {
        let args = OpenPositionArgs::try_from_slice(payload).map_err(|_| LeverageError::InvalidInstruction)?;
        return open_position(program_id, accounts, args);
    }
    if discriminator == legacy_instruction_discriminator("fill_position") {
        let args = FillPositionArgs::try_from_slice(payload).map_err(|_| LeverageError::InvalidInstruction)?;
        return fill_position(program_id, accounts, args);
    }
    if discriminator == legacy_instruction_discriminator("close_position") {
        let args = ClosePositionArgs::try_from_slice(payload).map_err(|_| LeverageError::InvalidInstruction)?;
        return close_position(program_id, accounts, args.usdc_received);
    }
    if discriminator == legacy_instruction_discriminator("liquidate") {
        let args = LiquidateArgs::try_from_slice(payload).map_err(|_| LeverageError::InvalidInstruction)?;
        return liquidate(program_id, accounts, args.current_price_bps);
    }
    if discriminator == legacy_instruction_discriminator("set_paused") {
        let args = SetPausedArgs::try_from_slice(payload).map_err(|_| LeverageError::InvalidInstruction)?;
        return set_paused(program_id, accounts, args.paused);
    }

    Err(LeverageError::InvalidInstruction.into())
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], max_leverage: u16) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let protocol_state = next_account_info(account_info_iter)?;
    let usdc_mint = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(system_program, &solana_program::system_program::id())?;
    let rent = Rent::get()?;

    let (expected_protocol, bump) = Pubkey::find_program_address(&[PROTOCOL_SEED], program_id);
    require_key(protocol_state, &expected_protocol)?;

    create_pda_account(
        admin,
        protocol_state,
        system_program,
        program_id,
        PROTOCOL_STATE_SPACE,
        rent.minimum_balance(PROTOCOL_STATE_SPACE),
        &[PROTOCOL_SEED, &[bump]],
    )?;

    let state = ProtocolState {
        admin: *admin.key,
        usdc_mint: *usdc_mint.key,
        max_leverage,
        liquidation_threshold: 80,
        total_positions: 0,
        total_open_positions: 0,
        total_volume: 0,
        bump,
        is_paused: false,
    };
    store_protocol_state(protocol_state, &state)?;
    msg!("Leverage protocol initialized");
    Ok(())
}

fn open_position(program_id: &Pubkey, accounts: &[AccountInfo], args: OpenPositionArgs) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let protocol_state = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;
    let position_escrow = next_account_info(account_info_iter)?;
    let usdc_mint = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;
    require_program(system_program, &solana_program::system_program::id())?;

    let mut protocol = load_protocol_state(protocol_state)?;
    require_key(protocol_state, &Pubkey::find_program_address(&[PROTOCOL_SEED], program_id).0)?;

    if protocol.is_paused {
        return Err(LeverageError::ProtocolPaused.into());
    }
    if args.margin_usdc < 1_000_000 {
        return Err(LeverageError::MarginTooLow.into());
    }
    if args.leverage_bps < 100 || args.leverage_bps > protocol.max_leverage {
        return Err(LeverageError::InvalidLeverage.into());
    }
    if protocol.usdc_mint != *usdc_mint.key {
        return Err(LeverageError::InvalidAccount.into());
    }

    let position_id = protocol.total_positions;
    let position_id_bytes = position_id.to_le_bytes();
    let (expected_position, position_bump) =
        Pubkey::find_program_address(&[POSITION_SEED, user.key.as_ref(), &position_id_bytes], program_id);
    let (expected_escrow, escrow_bump) =
        Pubkey::find_program_address(&[ESCROW_SEED, user.key.as_ref(), &position_id_bytes], program_id);
    require_key(position, &expected_position)?;
    require_key(position_escrow, &expected_escrow)?;

    let user_usdc = unpack_token_account(user_usdc_account)?;
    let mint = Mint::unpack(&usdc_mint.data.borrow())?;
    if user_usdc.mint != protocol.usdc_mint || user_usdc.owner != *user.key || mint.decimals != 6 {
        return Err(LeverageError::InvalidAccount.into());
    }

    let total_usdc = ((args.margin_usdc as u128)
        .checked_mul(args.leverage_bps as u128)
        .ok_or(LeverageError::Overflow)?
        .checked_div(100)
        .ok_or(LeverageError::Overflow)?) as u64;
    let borrowed_usdc = total_usdc.saturating_sub(args.margin_usdc);

    let rent = Rent::get()?;
    create_pda_account(
        user,
        position,
        system_program,
        program_id,
        POSITION_SPACE,
        rent.minimum_balance(POSITION_SPACE),
        &[POSITION_SEED, user.key.as_ref(), &position_id_bytes, &[position_bump]],
    )?;

    create_pda_account(
        user,
        position_escrow,
        system_program,
        token_program.key,
        TokenAccount::LEN,
        rent.minimum_balance(TokenAccount::LEN),
        &[ESCROW_SEED, user.key.as_ref(), &position_id_bytes, &[escrow_bump]],
    )?;

    invoke(
        &token_instruction::initialize_account(
            token_program.key,
            position_escrow.key,
            usdc_mint.key,
            position_escrow.key,
        )?,
        &[
            position_escrow.clone(),
            usdc_mint.clone(),
            position_escrow.clone(),
            rent_sysvar.clone(),
            token_program.clone(),
        ],
    )?;

    invoke(
        &token_instruction::transfer(
            token_program.key,
            user_usdc_account.key,
            position_escrow.key,
            user.key,
            &[],
            args.margin_usdc,
        )?,
        &[
            user_usdc_account.clone(),
            position_escrow.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;

    let state = Position {
        owner: *user.key,
        market_ticker: args.market_ticker,
        side: args.side,
        margin_usdc: args.margin_usdc,
        borrowed_usdc,
        total_usdc,
        leverage_bps: args.leverage_bps,
        outcome_tokens: 0,
        entry_price_bps: 0,
        status: PositionStatus::Pending,
        opened_at: solana_program::clock::Clock::get()?.unix_timestamp,
        closed_at: 0,
        bump: position_bump,
        escrow_bump,
        position_id,
    };
    store_position(position, &state)?;

    protocol.total_positions = protocol.total_positions.checked_add(1).ok_or(LeverageError::Overflow)?;
    protocol.total_open_positions = protocol
        .total_open_positions
        .checked_add(1)
        .ok_or(LeverageError::Overflow)?;
    protocol.total_volume = protocol
        .total_volume
        .checked_add(total_usdc)
        .ok_or(LeverageError::Overflow)?;
    store_protocol_state(protocol_state, &protocol)?;
    msg!("Position #{} opened", position_id);
    Ok(())
}

fn fill_position(program_id: &Pubkey, accounts: &[AccountInfo], args: FillPositionArgs) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let protocol_state = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    let protocol = load_protocol_state(protocol_state)?;
    require_key(protocol_state, &Pubkey::find_program_address(&[PROTOCOL_SEED], program_id).0)?;
    if protocol.admin != *admin.key {
        return Err(LeverageError::Unauthorized.into());
    }

    let mut state = load_position(position)?;
    require_key(
        position,
        &Pubkey::find_program_address(&[POSITION_SEED, state.owner.as_ref(), &state.position_id.to_le_bytes()], program_id).0,
    )?;
    if state.status != PositionStatus::Pending {
        return Err(LeverageError::InvalidPositionStatus.into());
    }

    state.outcome_tokens = args.outcome_tokens;
    state.entry_price_bps = args.entry_price_bps;
    state.status = PositionStatus::Open;
    store_position(position, &state)?;
    Ok(())
}

fn close_position(program_id: &Pubkey, accounts: &[AccountInfo], usdc_received: u64) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let protocol_state = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;
    let position_owner = next_account_info(account_info_iter)?;
    let position_escrow = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;

    let mut protocol = load_protocol_state(protocol_state)?;
    require_key(protocol_state, &Pubkey::find_program_address(&[PROTOCOL_SEED], program_id).0)?;
    if protocol.admin != *admin.key {
        return Err(LeverageError::Unauthorized.into());
    }

    let mut state = load_position(position)?;
    require_key(
        position,
        &Pubkey::find_program_address(&[POSITION_SEED, state.owner.as_ref(), &state.position_id.to_le_bytes()], program_id).0,
    )?;
    if state.status != PositionStatus::Open {
        return Err(LeverageError::InvalidPositionStatus.into());
    }
    if *position_owner.key != state.owner {
        return Err(LeverageError::InvalidAccount.into());
    }

    let escrow_account = unpack_token_account(position_escrow)?;
    let user_account = unpack_token_account(user_usdc_account)?;
    if escrow_account.mint != protocol.usdc_mint || user_account.mint != protocol.usdc_mint || user_account.owner != state.owner {
        return Err(LeverageError::InvalidAccount.into());
    }

    let repay_amount = state.borrowed_usdc;
    let user_return = if usdc_received > repay_amount {
        usdc_received.saturating_sub(repay_amount)
    } else {
        let loss = repay_amount.saturating_sub(usdc_received);
        state.margin_usdc.saturating_sub(loss)
    };

    if user_return > 0 {
        invoke_signed(
            &token_instruction::transfer(
                token_program.key,
                position_escrow.key,
                user_usdc_account.key,
                position_escrow.key,
                &[],
                user_return,
            )?,
            &[
                position_escrow.clone(),
                user_usdc_account.clone(),
                position_escrow.clone(),
                token_program.clone(),
            ],
            &[&[
                ESCROW_SEED,
                state.owner.as_ref(),
                &state.position_id.to_le_bytes(),
                &[state.escrow_bump],
            ]],
        )?;
    }

    state.status = PositionStatus::Closed;
    state.closed_at = solana_program::clock::Clock::get()?.unix_timestamp;
    store_position(position, &state)?;

    protocol.total_open_positions = protocol.total_open_positions.saturating_sub(1);
    store_protocol_state(protocol_state, &protocol)?;
    Ok(())
}

fn liquidate(program_id: &Pubkey, accounts: &[AccountInfo], current_price_bps: u16) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let liquidator = next_account_info(account_info_iter)?;
    let protocol_state = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;

    require_signer(liquidator)?;
    let mut protocol = load_protocol_state(protocol_state)?;
    require_key(protocol_state, &Pubkey::find_program_address(&[PROTOCOL_SEED], program_id).0)?;
    let mut state = load_position(position)?;
    require_key(
        position,
        &Pubkey::find_program_address(&[POSITION_SEED, state.owner.as_ref(), &state.position_id.to_le_bytes()], program_id).0,
    )?;
    if state.status != PositionStatus::Open {
        return Err(LeverageError::InvalidPositionStatus.into());
    }

    let current_value = ((state.outcome_tokens as u128)
        .checked_mul(current_price_bps as u128)
        .ok_or(LeverageError::Overflow)?
        .checked_div(10_000)
        .ok_or(LeverageError::Overflow)?) as u64;
    let liquidation_value = ((state.borrowed_usdc as u128)
        .checked_mul(protocol.liquidation_threshold as u128)
        .ok_or(LeverageError::Overflow)?
        .checked_div(100)
        .ok_or(LeverageError::Overflow)?) as u64;

    if current_value > liquidation_value {
        return Err(LeverageError::NotLiquidatable.into());
    }

    state.status = PositionStatus::Liquidated;
    state.closed_at = solana_program::clock::Clock::get()?.unix_timestamp;
    store_position(position, &state)?;

    protocol.total_open_positions = protocol.total_open_positions.saturating_sub(1);
    store_protocol_state(protocol_state, &protocol)?;
    Ok(())
}

fn set_paused(program_id: &Pubkey, accounts: &[AccountInfo], paused: bool) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let protocol_state = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    let mut protocol = load_protocol_state(protocol_state)?;
    require_key(protocol_state, &Pubkey::find_program_address(&[PROTOCOL_SEED], program_id).0)?;
    if protocol.admin != *admin.key {
        return Err(LeverageError::Unauthorized.into());
    }
    protocol.is_paused = paused;
    store_protocol_state(protocol_state, &protocol)?;
    Ok(())
}

fn create_pda_account<'a>(
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    owner: &Pubkey,
    space: usize,
    lamports: u64,
    signer_seeds: &[&[u8]],
) -> ProgramResult {
    if target.owner != &solana_program::system_program::id() || !target.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            target.key,
            lamports,
            space as u64,
            owner,
        ),
        &[payer.clone(), target.clone(), system_program.clone()],
        &[signer_seeds],
    )
}

fn load_protocol_state(account: &AccountInfo) -> Result<ProtocolState, ProgramError> {
    let data = account.data.borrow();
    ProtocolState::try_from_slice(&data[DISC_LEN..]).map_err(|_| LeverageError::InvalidAccount.into())
}

fn store_protocol_state(account: &AccountInfo, state: &ProtocolState) -> ProgramResult {
    let mut data = account.data.borrow_mut();
    data[..DISC_LEN].copy_from_slice(&legacy_account_discriminator("ProtocolState"));
    state.serialize(&mut &mut data[DISC_LEN..]).map_err(|_| LeverageError::InvalidAccount.into())
}

fn load_position(account: &AccountInfo) -> Result<Position, ProgramError> {
    let data = account.data.borrow();
    Position::try_from_slice(&data[DISC_LEN..]).map_err(|_| LeverageError::InvalidAccount.into())
}

fn store_position(account: &AccountInfo, state: &Position) -> ProgramResult {
    let mut data = account.data.borrow_mut();
    data[..DISC_LEN].copy_from_slice(&legacy_account_discriminator("Position"));
    state.serialize(&mut &mut data[DISC_LEN..]).map_err(|_| LeverageError::InvalidAccount.into())
}

fn unpack_token_account(account: &AccountInfo) -> Result<TokenAccount, ProgramError> {
    TokenAccount::unpack(&account.data.borrow()).map_err(ProgramError::from)
}

fn require_signer(account: &AccountInfo) -> ProgramResult {
    if !account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

fn require_key(account: &AccountInfo, expected: &Pubkey) -> ProgramResult {
    if account.key != expected {
        return Err(LeverageError::InvalidAccount.into());
    }
    Ok(())
}

fn require_program(account: &AccountInfo, expected: &Pubkey) -> ProgramResult {
    if account.key != expected {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

fn legacy_instruction_discriminator(name: &str) -> [u8; 8] {
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash(format!("global:{name}").as_bytes()).to_bytes()[..8]);
    bytes
}

fn legacy_account_discriminator(name: &str) -> [u8; 8] {
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash(format!("account:{name}").as_bytes()).to_bytes()[..8]);
    bytes
}
