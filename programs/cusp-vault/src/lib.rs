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
    system_instruction,
    rent::Rent,
    sysvar::Sysvar,
};
use spl_token::instruction as token_instruction;
use spl_token::state::{Account as TokenAccount, Mint};

solana_program::declare_id!("9Jucf5RimpEJnCun98q258zXx9A6n9fP4JHzNzsJ9DBF");

const VAULT_SEED: &[u8] = b"vault";
const CUSDC_MINT_SEED: &[u8] = b"cusdc-mint";
const VAULT_USDC_SEED: &[u8] = b"vault-usdc";
const VAULT_STATE_DISCRIMINATOR_LEN: usize = 8;
const VAULT_STATE_SPACE: usize = VAULT_STATE_DISCRIMINATOR_LEN + 32 * 4 + 8 * 3 + 3;

entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct VaultState {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub cusdc_mint: Pubkey,
    pub vault_usdc_account: Pubkey,
    pub total_usdc_managed: u64,
    pub total_cusdc_supply: u64,
    pub total_deployed: u64,
    pub bump: u8,
    pub cusdc_mint_bump: u8,
    pub is_paused: bool,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct InitializeArgs {
    usdc_mint: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct AmountArgs {
    amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct SetPausedArgs {
    paused: bool,
}

#[repr(u32)]
enum VaultError {
    ZeroAmount = 1,
    DepositTooSmall = 2,
    WithdrawTooSmall = 3,
    InsufficientVaultFunds = 4,
    Overflow = 5,
    VaultPaused = 6,
    Unauthorized = 7,
    ReserveTooLow = 8,
    ReturnExceedsDeployed = 9,
    InvalidInstruction = 10,
    InvalidAccount = 11,
}

impl From<VaultError> for ProgramError {
    fn from(value: VaultError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, payload) = instruction_data
        .split_first_chunk::<8>()
        .ok_or(VaultError::InvalidInstruction)?;

    if *discriminator == legacy_instruction_discriminator("initialize") {
        let args = InitializeArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return initialize(program_id, accounts, args);
    }
    if *discriminator == legacy_instruction_discriminator("init_vault_account") {
        return init_vault_account(program_id, accounts);
    }
    if *discriminator == legacy_instruction_discriminator("deposit") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return deposit(program_id, accounts, args.amount);
    }
    if *discriminator == legacy_instruction_discriminator("withdraw") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return withdraw(program_id, accounts, args.amount);
    }
    if *discriminator == legacy_instruction_discriminator("deploy_funds") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return deploy_funds(program_id, accounts, args.amount);
    }
    if *discriminator == legacy_instruction_discriminator("return_funds") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return return_funds(program_id, accounts, args.amount);
    }
    if *discriminator == legacy_instruction_discriminator("add_yield") {
        let args = AmountArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return add_yield(program_id, accounts, args.amount);
    }
    if *discriminator == legacy_instruction_discriminator("set_paused") {
        let args = SetPausedArgs::try_from_slice(payload).map_err(|_| VaultError::InvalidInstruction)?;
        return set_paused(program_id, accounts, args.paused);
    }

    Err(VaultError::InvalidInstruction.into())
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], args: InitializeArgs) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let cusdc_mint = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;
    require_program(system_program, &solana_program::system_program::id())?;
    let rent = Rent::from_account_info(rent_sysvar)?;

    let (expected_vault, vault_bump) = Pubkey::find_program_address(&[VAULT_SEED], program_id);
    let (expected_mint, cusdc_mint_bump) = Pubkey::find_program_address(&[CUSDC_MINT_SEED], program_id);
    require_key(vault_state, &expected_vault)?;
    require_key(cusdc_mint, &expected_mint)?;

    create_pda_account(
        admin,
        vault_state,
        system_program,
        program_id,
        VAULT_STATE_SPACE,
        rent.minimum_balance(VAULT_STATE_SPACE),
        &[VAULT_SEED, &[vault_bump]],
    )?;

    create_pda_account(
        admin,
        cusdc_mint,
        system_program,
        token_program.key,
        Mint::LEN,
        rent.minimum_balance(Mint::LEN),
        &[CUSDC_MINT_SEED, &[cusdc_mint_bump]],
    )?;

    invoke(
        &token_instruction::initialize_mint(
            token_program.key,
            cusdc_mint.key,
            vault_state.key,
            None,
            6,
        )?,
        &[cusdc_mint.clone(), rent_sysvar.clone(), token_program.clone()],
    )?;

    let state = VaultState {
        admin: *admin.key,
        usdc_mint: args.usdc_mint,
        cusdc_mint: *cusdc_mint.key,
        vault_usdc_account: Pubkey::default(),
        total_usdc_managed: 0,
        total_cusdc_supply: 0,
        total_deployed: 0,
        bump: vault_bump,
        cusdc_mint_bump,
        is_paused: false,
    };
    store_vault_state(vault_state, &state)?;
    msg!("Vault state + cUSDC mint created");
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
    if state.admin != *admin.key {
        return Err(VaultError::Unauthorized.into());
    }
    if state.usdc_mint != *usdc_mint.key {
        return Err(VaultError::InvalidAccount.into());
    }

    let (expected_vault_usdc, _) = Pubkey::find_program_address(&[VAULT_USDC_SEED], program_id);
    require_key(vault_usdc_account, &expected_vault_usdc)?;

    create_pda_account(
        admin,
        vault_usdc_account,
        system_program,
        token_program.key,
        TokenAccount::LEN,
        rent.minimum_balance(TokenAccount::LEN),
        &[VAULT_USDC_SEED, &[Pubkey::find_program_address(&[VAULT_USDC_SEED], program_id).1]],
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
    msg!("Vault USDC account created");
    Ok(())
}

fn deposit(program_id: &Pubkey, accounts: &[AccountInfo], usdc_amount: u64) -> ProgramResult {
    if usdc_amount == 0 {
        return Err(VaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let cusdc_mint = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let user_cusdc_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.is_paused {
        return Err(VaultError::VaultPaused.into());
    }
    require_key(cusdc_mint, &state.cusdc_mint)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;

    let user_usdc = unpack_token_account(user_usdc_account)?;
    let user_cusdc = unpack_token_account(user_cusdc_account)?;
    let vault_usdc = unpack_token_account(vault_usdc_account)?;
    let mint = Mint::unpack(&cusdc_mint.data.borrow())?;

    if user_usdc.mint != state.usdc_mint || user_usdc.owner != *user.key {
        return Err(VaultError::InvalidAccount.into());
    }
    if user_cusdc.mint != state.cusdc_mint || mint.mint_authority.is_none() {
        return Err(VaultError::InvalidAccount.into());
    }
    if vault_usdc.mint != state.usdc_mint {
        return Err(VaultError::InvalidAccount.into());
    }

    let cusdc_to_mint = if state.total_cusdc_supply == 0 || state.total_usdc_managed == 0 {
        usdc_amount
    } else {
        ((usdc_amount as u128)
            .checked_mul(state.total_cusdc_supply as u128)
            .ok_or(VaultError::Overflow)?
            .checked_div(state.total_usdc_managed as u128)
            .ok_or(VaultError::Overflow)?) as u64
    };
    if cusdc_to_mint == 0 {
        return Err(VaultError::DepositTooSmall.into());
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
            cusdc_mint.key,
            user_cusdc_account.key,
            vault_state.key,
            &[],
            cusdc_to_mint,
        )?,
        &[
            cusdc_mint.clone(),
            user_cusdc_account.clone(),
            vault_state.clone(),
            token_program.clone(),
        ],
        &[&[VAULT_SEED, &[state.bump]]],
    )?;

    state.total_usdc_managed = state
        .total_usdc_managed
        .checked_add(usdc_amount)
        .ok_or(VaultError::Overflow)?;
    state.total_cusdc_supply = state
        .total_cusdc_supply
        .checked_add(cusdc_to_mint)
        .ok_or(VaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;

    msg!("Deposited {} USDC, minted {} cUSDC", usdc_amount, cusdc_to_mint);
    Ok(())
}

fn withdraw(program_id: &Pubkey, accounts: &[AccountInfo], cusdc_amount: u64) -> ProgramResult {
    if cusdc_amount == 0 {
        return Err(VaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let cusdc_mint = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let user_cusdc_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    if state.is_paused {
        return Err(VaultError::VaultPaused.into());
    }
    require_key(cusdc_mint, &state.cusdc_mint)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;

    let user_usdc = unpack_token_account(user_usdc_account)?;
    let user_cusdc = unpack_token_account(user_cusdc_account)?;
    let vault_usdc = unpack_token_account(vault_usdc_account)?;

    if user_usdc.mint != state.usdc_mint || user_usdc.owner != *user.key {
        return Err(VaultError::InvalidAccount.into());
    }
    if user_cusdc.mint != state.cusdc_mint || user_cusdc.owner != *user.key {
        return Err(VaultError::InvalidAccount.into());
    }
    if vault_usdc.mint != state.usdc_mint {
        return Err(VaultError::InvalidAccount.into());
    }
    if state.total_cusdc_supply == 0 {
        return Err(VaultError::WithdrawTooSmall.into());
    }

    let usdc_to_return = ((cusdc_amount as u128)
        .checked_mul(state.total_usdc_managed as u128)
        .ok_or(VaultError::Overflow)?
        .checked_div(state.total_cusdc_supply as u128)
        .ok_or(VaultError::Overflow)?) as u64;
    if usdc_to_return == 0 {
        return Err(VaultError::WithdrawTooSmall.into());
    }

    let available = state.total_usdc_managed.saturating_sub(state.total_deployed);
    if usdc_to_return > available {
        return Err(VaultError::InsufficientVaultFunds.into());
    }

    invoke(
        &token_instruction::burn(
            token_program.key,
            user_cusdc_account.key,
            cusdc_mint.key,
            user.key,
            &[],
            cusdc_amount,
        )?,
        &[
            user_cusdc_account.clone(),
            cusdc_mint.clone(),
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

    state.total_usdc_managed = state
        .total_usdc_managed
        .checked_sub(usdc_to_return)
        .ok_or(VaultError::Overflow)?;
    state.total_cusdc_supply = state
        .total_cusdc_supply
        .checked_sub(cusdc_amount)
        .ok_or(VaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;

    msg!("Withdrew {} USDC, burned {} cUSDC", usdc_to_return, cusdc_amount);
    Ok(())
}

fn deploy_funds(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    if amount == 0 {
        return Err(VaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let destination = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;
    if state.admin != *admin.key {
        return Err(VaultError::Unauthorized.into());
    }

    let vault_usdc = unpack_token_account(vault_usdc_account)?;
    let destination_account = unpack_token_account(destination)?;
    if vault_usdc.mint != state.usdc_mint || destination_account.mint != state.usdc_mint {
        return Err(VaultError::InvalidAccount.into());
    }

    let available = state.total_usdc_managed.saturating_sub(state.total_deployed);
    if amount > available {
        return Err(VaultError::InsufficientVaultFunds.into());
    }
    let remaining = available.saturating_sub(amount);
    let min_reserve = state.total_usdc_managed / 5;
    if !(remaining >= min_reserve || state.total_usdc_managed <= 1_000_000) {
        return Err(VaultError::ReserveTooLow.into());
    }

    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            vault_usdc_account.key,
            destination.key,
            vault_state.key,
            &[],
            amount,
        )?,
        &[
            vault_usdc_account.clone(),
            destination.clone(),
            vault_state.clone(),
            token_program.clone(),
        ],
        &[&[VAULT_SEED, &[state.bump]]],
    )?;

    state.total_deployed = state
        .total_deployed
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;
    msg!("Deployed {} USDC", amount);
    Ok(())
}

fn return_funds(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    if amount == 0 {
        return Err(VaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let source = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;
    if state.admin != *admin.key {
        return Err(VaultError::Unauthorized.into());
    }
    if amount > state.total_deployed {
        return Err(VaultError::ReturnExceedsDeployed.into());
    }

    let source_account = unpack_token_account(source)?;
    let vault_usdc = unpack_token_account(vault_usdc_account)?;
    if source_account.mint != state.usdc_mint || source_account.owner != *admin.key || vault_usdc.mint != state.usdc_mint {
        return Err(VaultError::InvalidAccount.into());
    }

    invoke(
        &token_instruction::transfer(
            token_program.key,
            source.key,
            vault_usdc_account.key,
            admin.key,
            &[],
            amount,
        )?,
        &[
            source.clone(),
            vault_usdc_account.clone(),
            admin.clone(),
            token_program.clone(),
        ],
    )?;

    state.total_deployed = state
        .total_deployed
        .checked_sub(amount)
        .ok_or(VaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;
    msg!("Returned {} USDC", amount);
    Ok(())
}

fn add_yield(program_id: &Pubkey, accounts: &[AccountInfo], usdc_amount: u64) -> ProgramResult {
    if usdc_amount == 0 {
        return Err(VaultError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let vault_state = next_account_info(account_info_iter)?;
    let vault_usdc_account = next_account_info(account_info_iter)?;
    let admin_usdc_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(token_program, &spl_token::id())?;

    let mut state = load_vault_state(vault_state)?;
    require_key(vault_state, &Pubkey::find_program_address(&[VAULT_SEED], program_id).0)?;
    require_key(vault_usdc_account, &state.vault_usdc_account)?;
    if state.admin != *admin.key {
        return Err(VaultError::Unauthorized.into());
    }

    let admin_usdc = unpack_token_account(admin_usdc_account)?;
    let vault_usdc = unpack_token_account(vault_usdc_account)?;
    if admin_usdc.mint != state.usdc_mint || admin_usdc.owner != *admin.key || vault_usdc.mint != state.usdc_mint {
        return Err(VaultError::InvalidAccount.into());
    }

    invoke(
        &token_instruction::transfer(
            token_program.key,
            admin_usdc_account.key,
            vault_usdc_account.key,
            admin.key,
            &[],
            usdc_amount,
        )?,
        &[
            admin_usdc_account.clone(),
            vault_usdc_account.clone(),
            admin.clone(),
            token_program.clone(),
        ],
    )?;

    state.total_usdc_managed = state
        .total_usdc_managed
        .checked_add(usdc_amount)
        .ok_or(VaultError::Overflow)?;
    store_vault_state(vault_state, &state)?;
    msg!("Added {} USDC yield", usdc_amount);
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
        return Err(VaultError::Unauthorized.into());
    }
    state.is_paused = paused;
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
    if data.len() < VAULT_STATE_DISCRIMINATOR_LEN {
        return Err(VaultError::InvalidAccount.into());
    }
    VaultState::try_from_slice(&data[VAULT_STATE_DISCRIMINATOR_LEN..]).map_err(|_| VaultError::InvalidAccount.into())
}

fn store_vault_state(account: &AccountInfo, state: &VaultState) -> ProgramResult {
    let mut data = account.data.borrow_mut();
    data[..8].copy_from_slice(&legacy_account_discriminator("VaultState"));
    state.serialize(&mut &mut data[8..]).map_err(|_| VaultError::InvalidAccount.into())
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
        return Err(VaultError::InvalidAccount.into());
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
