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

solana_program::declare_id!("Bs53nqkzB4x81giq2Vc8SC6NLK7euxWThkcuj3UVZZcp");

const VAULT_SEED: &[u8] = b"earn-vault";
const CUSDT_MINT_SEED: &[u8] = b"cusdt-mint";
const VAULT_USDC_SEED: &[u8] = b"earn-vault-usdc";
const DISC_LEN: usize = 8;
const VAULT_STATE_SPACE: usize = DISC_LEN + 32 * 5 + 8 * 5 + 3;

entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct VaultState {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub usdt_mint: Pubkey,
    pub cusdt_mint: Pubkey,
    pub vault_usdc_account: Pubkey,
    pub total_usdc_balance: u64,
    pub total_cusdt_supply: u64,
    pub kamino_shares_value: u64,
    pub kamino_apy_bps: u64,
    pub performance_fee_bps: u64,
    pub bump: u8,
    pub cusdt_mint_bump: u8,
    pub is_paused: bool,
    pub seconds_since_epoch: u64,
}

impl VaultState {
    fn exchange_rate_bps(&self) -> u64 {
        if self.total_cusdt_supply == 0 {
            10_000
        } else {
            ((self.total_usdc_balance as u128)
                .checked_mul(10_000)
                .unwrap()
                .checked_div(self.total_cusdt_supply as u128)
                .unwrap()) as u64
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize)]
struct InitializeArgs {
    usdc_mint: Pubkey,
    usdt_mint: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct AmountArgs {
    amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct BoolArgs {
    value: bool,
}

#[repr(u32)]
enum EarnVaultError {
    ZeroAmount = 1,
    DepositTooSmall = 2,
    WithdrawTooSmall = 3,
    InsufficientLiquidity = 4,
    Overflow = 5,
    VaultPaused = 6,
    Unauthorized = 7,
    FeeTooHigh = 8,
    InvalidInstruction = 9,
    InvalidAccount = 10,
}

impl From<EarnVaultError> for ProgramError {
    fn from(value: EarnVaultError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() < 8 {
        return Err(EarnVaultError::InvalidInstruction.into());
    }
    let discriminator: [u8; 8] = instruction_data[..8]
        .try_into()
        .map_err(|_| EarnVaultError::InvalidInstruction)?;
    let payload = &instruction_data[8..];

    if discriminator == legacy_instruction_discriminator("initialize") {
        let args = InitializeArgs::try_from_slice(payload).map_err(|_| EarnVaultError::InvalidInstruction)?;
        return initialize(program_id, accounts, args);
    }
    if discriminator == legacy_instruction_discriminator("init_vault_account") {
        return init_vault_account(program_id, accounts);
    }
    if discriminator == legacy_instruction_discriminator("deposit") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| EarnVaultError::InvalidInstruction)?;
        return deposit(program_id, accounts, args.amount);
    }
    if discriminator == legacy_instruction_discriminator("withdraw") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| EarnVaultError::InvalidInstruction)?;
        return withdraw(program_id, accounts, args.amount);
    }
    if discriminator == legacy_instruction_discriminator("sync_yield") {
        return sync_yield(program_id, accounts);
    }
    if discriminator == legacy_instruction_discriminator("update_kamino_apy") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| EarnVaultError::InvalidInstruction)?;
        return update_kamino_apy(program_id, accounts, args.amount);
    }
    if discriminator == legacy_instruction_discriminator("set_paused") {
        let args = BoolArgs::try_from_slice(payload).map_err(|_| EarnVaultError::InvalidInstruction)?;
        return set_paused(program_id, accounts, args.value);
    }
    if discriminator == legacy_instruction_discriminator("set_performance_fee") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| EarnVaultError::InvalidInstruction)?;
        return set_performance_fee(program_id, accounts, args.amount);
    }

    Err(EarnVaultError::InvalidInstruction.into())
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], args: InitializeArgs) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let cusdt_mint = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;
    require_program(system_program, &solana_program::system_program::id())?;
    let rent = Rent::from_account_info(rent_sysvar)?;

    let (expected_vault, bump) = Pubkey::find_program_address(&[VAULT_SEED], program_id);
    let (expected_mint, cusdt_mint_bump) = Pubkey::find_program_address(&[CUSDT_MINT_SEED], program_id);
    require_key(vault_state, &expected_vault)?;
    require_key(cusdt_mint, &expected_mint)?;

    create_pda_account(
        admin,
        vault_state,
        system_program,
        program_id,
        VAULT_STATE_SPACE,
        rent.minimum_balance(VAULT_STATE_SPACE),
        &[VAULT_SEED, &[bump]],
    )?;

    create_pda_account(
        admin,
        cusdt_mint,
        system_program,
        token_program.key,
        Mint::LEN,
        rent.minimum_balance(Mint::LEN),
        &[CUSDT_MINT_SEED, &[cusdt_mint_bump]],
    )?;

    invoke(
        &token_instruction::initialize_mint(
            token_program.key,
            cusdt_mint.key,
            vault_state.key,
            None,
            6,
        )?,
        &[cusdt_mint.clone(), rent_sysvar.clone(), token_program.clone()],
    )?;

    let state = VaultState {
        admin: *admin.key,
        usdc_mint: args.usdc_mint,
        usdt_mint: args.usdt_mint,
        cusdt_mint: *cusdt_mint.key,
        vault_usdc_account: Pubkey::default(),
        total_usdc_balance: 0,
        total_cusdt_supply: 0,
        kamino_shares_value: 0,
        kamino_apy_bps: 0,
        performance_fee_bps: 500,
        bump,
        cusdt_mint_bump,
        is_paused: false,
        seconds_since_epoch: 0,
    };
    store_vault_state(vault_state, &state)?;
    Ok(())
}

fn init_vault_account(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let usdc_mint = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;
    require_program(system_program, &solana_program::system_program::id())?;
    let rent = Rent::from_account_info(rent_sysvar)?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.admin != *admin.key || state.usdc_mint != *usdc_mint.key {
        return Err(EarnVaultError::Unauthorized.into());
    }

    let (expected_vault_usdc, vault_usdc_bump) = Pubkey::find_program_address(&[VAULT_USDC_SEED], program_id);
    require_key(vault_usdc_account, &expected_vault_usdc)?;

    create_pda_account(
        admin,
        vault_usdc_account,
        system_program,
        token_program.key,
        TokenAccount::LEN,
        rent.minimum_balance(TokenAccount::LEN),
        &[VAULT_USDC_SEED, &[vault_usdc_bump]],
    )?;

    invoke(
        &token_instruction::initialize_account(
            token_program.key,
            vault_usdc_account.key,
            usdc_mint.key,
            vault_state.key,
        )?,
        &[
            vault_usdc_account.clone(),
            usdc_mint.clone(),
            vault_state.clone(),
            rent_sysvar.clone(),
            token_program.clone(),
        ],
    )?;

    state.vault_usdc_account = *vault_usdc_account.key;
    store_vault_state(vault_state, &state)?;
    Ok(())
}

fn deposit(program_id: &Pubkey, accounts: &[AccountInfo], usdc_amount: u64) -> ProgramResult {
    if usdc_amount == 0 {
        return Err(EarnVaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let cusdt_mint = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let user_cusdt_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.is_paused {
        return Err(EarnVaultError::VaultPaused.into());
    }
    require_key(cusdt_mint, &state.cusdt_mint)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;

    let user_usdc = unpack_token_account(user_usdc_account)?;
    let user_cusdt = unpack_token_account(user_cusdt_account)?;
    let vault_usdc = unpack_token_account(vault_usdc_account)?;

    if user_usdc.mint != state.usdc_mint || user_usdc.owner != *user.key {
        return Err(EarnVaultError::InvalidAccount.into());
    }
    if user_cusdt.mint != state.cusdt_mint || vault_usdc.mint != state.usdc_mint {
        return Err(EarnVaultError::InvalidAccount.into());
    }

    let cusdt_to_mint = if state.total_cusdt_supply == 0 || state.total_usdc_balance == 0 {
        usdc_amount
    } else {
        ((usdc_amount as u128)
            .checked_mul(state.total_cusdt_supply as u128)
            .ok_or(EarnVaultError::Overflow)?
            .checked_div(state.total_usdc_balance as u128)
            .ok_or(EarnVaultError::Overflow)?) as u64
    };
    if cusdt_to_mint == 0 {
        return Err(EarnVaultError::DepositTooSmall.into());
    }

    invoke(
        &token_instruction::transfer(
            token_program.key,
            user_usdc_account.key,
            vault_usdc_account.key,
            user.key,
            &[],
            usdc_amount,
        )?,
        &[
            user_usdc_account.clone(),
            vault_usdc_account.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;

    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            cusdt_mint.key,
            user_cusdt_account.key,
            vault_state.key,
            &[],
            cusdt_to_mint,
        )?,
        &[
            cusdt_mint.clone(),
            user_cusdt_account.clone(),
            vault_state.clone(),
            token_program.clone(),
        ],
        &[&[VAULT_SEED, &[state.bump]]],
    )?;

    state.total_usdc_balance = state
        .total_usdc_balance
        .checked_add(usdc_amount)
        .ok_or(EarnVaultError::Overflow)?;
    state.total_cusdt_supply = state
        .total_cusdt_supply
        .checked_add(cusdt_to_mint)
        .ok_or(EarnVaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;
    msg!("Deposited {} USDC, minted {} cUSDT", usdc_amount, cusdt_to_mint);
    Ok(())
}

fn withdraw(program_id: &Pubkey, accounts: &[AccountInfo], cusdt_amount: u64) -> ProgramResult {
    if cusdt_amount == 0 {
        return Err(EarnVaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let cusdt_mint = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let user_cusdt_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.is_paused {
        return Err(EarnVaultError::VaultPaused.into());
    }
    require_key(cusdt_mint, &state.cusdt_mint)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;

    let user_usdc = unpack_token_account(user_usdc_account)?;
    let user_cusdt = unpack_token_account(user_cusdt_account)?;
    let vault_usdc = unpack_token_account(vault_usdc_account)?;

    if user_usdc.mint != state.usdc_mint || user_usdc.owner != *user.key {
        return Err(EarnVaultError::InvalidAccount.into());
    }
    if user_cusdt.mint != state.cusdt_mint || user_cusdt.owner != *user.key || vault_usdc.mint != state.usdc_mint {
        return Err(EarnVaultError::InvalidAccount.into());
    }
    if state.total_cusdt_supply == 0 {
        return Err(EarnVaultError::WithdrawTooSmall.into());
    }

    let usdc_to_return = ((cusdt_amount as u128)
        .checked_mul(state.total_usdc_balance as u128)
        .ok_or(EarnVaultError::Overflow)?
        .checked_div(state.total_cusdt_supply as u128)
        .ok_or(EarnVaultError::Overflow)?) as u64;
    if usdc_to_return == 0 {
        return Err(EarnVaultError::WithdrawTooSmall.into());
    }
    if usdc_to_return > vault_usdc.amount {
        return Err(EarnVaultError::InsufficientLiquidity.into());
    }

    invoke(
        &token_instruction::burn(
            token_program.key,
            user_cusdt_account.key,
            cusdt_mint.key,
            user.key,
            &[],
            cusdt_amount,
        )?,
        &[
            user_cusdt_account.clone(),
            cusdt_mint.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;

    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            vault_usdc_account.key,
            user_usdc_account.key,
            vault_state.key,
            &[],
            usdc_to_return,
        )?,
        &[
            vault_usdc_account.clone(),
            user_usdc_account.clone(),
            vault_state.clone(),
            token_program.clone(),
        ],
        &[&[VAULT_SEED, &[state.bump]]],
    )?;

    state.total_usdc_balance = state
        .total_usdc_balance
        .checked_sub(usdc_to_return)
        .ok_or(EarnVaultError::Overflow)?;
    state.total_cusdt_supply = state
        .total_cusdt_supply
        .checked_sub(cusdt_amount)
        .ok_or(EarnVaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;
    msg!("Withdrew {} USDC, burned {} cUSDT", usdc_to_return, cusdt_amount);
    Ok(())
}

fn sync_yield(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.admin != *admin.key || state.vault_usdc_account != *vault_usdc_account.key {
        return Err(EarnVaultError::Unauthorized.into());
    }

    let vault_token = unpack_token_account(vault_usdc_account)?;
    let actual_balance = vault_token.amount;
    state.total_usdc_balance = actual_balance;
    state.seconds_since_epoch = solana_program::clock::Clock::get()?.unix_timestamp as u64;
    store_vault_state(vault_state, &state)?;
    msg!("Yield synced. Rate: {} bps", state.exchange_rate_bps());
    Ok(())
}

fn update_kamino_apy(program_id: &Pubkey, accounts: &[AccountInfo], apy_bps: u64) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.admin != *admin.key {
        return Err(EarnVaultError::Unauthorized.into());
    }
    state.kamino_apy_bps = apy_bps;
    store_vault_state(vault_state, &state)?;
    Ok(())
}

fn set_paused(program_id: &Pubkey, accounts: &[AccountInfo], paused: bool) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.admin != *admin.key {
        return Err(EarnVaultError::Unauthorized.into());
    }
    state.is_paused = paused;
    store_vault_state(vault_state, &state)?;
    Ok(())
}

fn set_performance_fee(program_id: &Pubkey, accounts: &[AccountInfo], fee_bps: u64) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    if fee_bps > 1000 {
        return Err(EarnVaultError::FeeTooHigh.into());
    }
    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.admin != *admin.key {
        return Err(EarnVaultError::Unauthorized.into());
    }
    state.performance_fee_bps = fee_bps;
    store_vault_state(vault_state, &state)?;
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

fn load_vault_state(account: &AccountInfo) -> Result<VaultState, ProgramError> {
    let data = account.data.borrow();
    VaultState::try_from_slice(&data[DISC_LEN..]).map_err(|_| EarnVaultError::InvalidAccount.into())
}

fn store_vault_state(account: &AccountInfo, state: &VaultState) -> ProgramResult {
    let mut data = account.data.borrow_mut();
    data[..DISC_LEN].copy_from_slice(&legacy_account_discriminator("VaultState"));
    state.serialize(&mut &mut data[DISC_LEN..]).map_err(|_| EarnVaultError::InvalidAccount.into())
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
        return Err(EarnVaultError::InvalidAccount.into());
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
