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
use spl_token::state::Account as TokenAccount;

solana_program::declare_id!("9djP4j3q8zJ6V4gkqS8n8t7YwR6u2Hk4Mv3aQ5f5z7oX");

const CONFIG_SEED: &[u8] = b"escrow-config";
const POSITION_SEED: &[u8] = b"position";
const VAULT_TOKEN_SEED: &[u8] = b"vault-token";
const DISCRIMINATOR_LEN: usize = 8;
const ESCROW_CONFIG_SPACE: usize = DISCRIMINATOR_LEN + 32 + 32 + 1 + 1;
const COLLATERAL_POSITION_SPACE: usize = DISCRIMINATOR_LEN + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1;

entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct EscrowConfig {
    pub admin: Pubkey,
    pub liquidation_authority: Pubkey,
    pub bump: u8,
    pub is_paused: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct CollateralPosition {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub market_hash: [u8; 32],
    pub escrow_config: Pubkey,
    pub amount_locked: u64,
    pub position_id: u64,
    pub side: u8,
    pub status: u8,
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct InitializeConfigArgs {
    liquidation_authority: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
struct InitializePositionArgs {
    position_id: u64,
    market_hash: [u8; 32],
    side: u8,
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
enum EscrowError {
    InvalidInstruction = 1,
    InvalidAccount = 2,
    Unauthorized = 3,
    VaultPaused = 4,
    ZeroAmount = 5,
    InvalidSide = 6,
    InvalidStatus = 7,
    Overflow = 8,
}

impl From<EscrowError> for ProgramError {
    fn from(value: EscrowError) -> Self {
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
        .ok_or(EscrowError::InvalidInstruction)?;

    if *discriminator == instruction_discriminator("initialize_config") {
        let args = InitializeConfigArgs::try_from_slice(payload)
            .map_err(|_| EscrowError::InvalidInstruction)?;
        return initialize_config(program_id, accounts, args);
    }
    if *discriminator == instruction_discriminator("initialize_position") {
        let args = InitializePositionArgs::try_from_slice(payload)
            .map_err(|_| EscrowError::InvalidInstruction)?;
        return initialize_position(program_id, accounts, args);
    }
    if *discriminator == instruction_discriminator("deposit_collateral") {
        let args =
            AmountArgs::try_from_slice(payload).map_err(|_| EscrowError::InvalidInstruction)?;
        return deposit_collateral(program_id, accounts, args.amount);
    }
    if *discriminator == instruction_discriminator("release_collateral") {
        let args =
            AmountArgs::try_from_slice(payload).map_err(|_| EscrowError::InvalidInstruction)?;
        return release_collateral(program_id, accounts, args.amount);
    }
    if *discriminator == instruction_discriminator("seize_collateral") {
        let args =
            AmountArgs::try_from_slice(payload).map_err(|_| EscrowError::InvalidInstruction)?;
        return seize_collateral(program_id, accounts, args.amount);
    }
    if *discriminator == instruction_discriminator("set_paused") {
        let args =
            SetPausedArgs::try_from_slice(payload).map_err(|_| EscrowError::InvalidInstruction)?;
        return set_paused(program_id, accounts, args.paused);
    }

    Err(EscrowError::InvalidInstruction.into())
}

fn initialize_config(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: InitializeConfigArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    require_program(system_program, &solana_program::system_program::id())?;

    let (expected_config, bump) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    require_key(config, &expected_config)?;

    create_pda_account(
        admin,
        config,
        system_program,
        program_id,
        ESCROW_CONFIG_SPACE,
        Rent::get()?.minimum_balance(ESCROW_CONFIG_SPACE),
        &[CONFIG_SEED, &[bump]],
    )?;

    store_with_discriminator(
        config,
        "EscrowConfig",
        &EscrowConfig {
            admin: *admin.key,
            liquidation_authority: args.liquidation_authority,
            bump,
            is_paused: false,
        },
    )?;

    msg!("Escrow config initialized");
    Ok(())
}

fn initialize_position(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: InitializePositionArgs,
) -> ProgramResult {
    if args.side > 1 {
        return Err(EscrowError::InvalidSide.into());
    }

    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;
    let vault_token_account = next_account_info(account_info_iter)?;
    let mint = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;
    require_program(system_program, &solana_program::system_program::id())?;

    let escrow_config: EscrowConfig = load_with_discriminator(config, "EscrowConfig")?;
    if escrow_config.is_paused {
        return Err(EscrowError::VaultPaused.into());
    }

    let (expected_config, _) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    require_key(config, &expected_config)?;

    let position_id_bytes = args.position_id.to_le_bytes();
    let (expected_position, position_bump) = Pubkey::find_program_address(
        &[POSITION_SEED, user.key.as_ref(), mint.key.as_ref(), &position_id_bytes],
        program_id,
    );
    require_key(position, &expected_position)?;

    create_pda_account(
        user,
        position,
        system_program,
        program_id,
        COLLATERAL_POSITION_SPACE,
        Rent::get()?.minimum_balance(COLLATERAL_POSITION_SPACE),
        &[
            POSITION_SEED,
            user.key.as_ref(),
            mint.key.as_ref(),
            &position_id_bytes,
            &[position_bump],
        ],
    )?;

    let (expected_vault_token, vault_token_bump) = Pubkey::find_program_address(
        &[VAULT_TOKEN_SEED, position.key.as_ref()],
        program_id,
    );
    require_key(vault_token_account, &expected_vault_token)?;

    create_pda_account(
        user,
        vault_token_account,
        system_program,
        token_program.key,
        TokenAccount::LEN,
        Rent::from_account_info(rent_sysvar)?.minimum_balance(TokenAccount::LEN),
        &[VAULT_TOKEN_SEED, position.key.as_ref(), &[vault_token_bump]],
    )?;

    invoke(
        &token_instruction::initialize_account(
            token_program.key,
            vault_token_account.key,
            mint.key,
            config.key,
        )?,
        &[
            vault_token_account.clone(),
            mint.clone(),
            config.clone(),
            rent_sysvar.clone(),
            token_program.clone(),
        ],
    )?;

    store_with_discriminator(
        position,
        "CollateralPosition",
        &CollateralPosition {
            owner: *user.key,
            mint: *mint.key,
            vault_token_account: *vault_token_account.key,
            market_hash: args.market_hash,
            escrow_config: *config.key,
            amount_locked: 0,
            position_id: args.position_id,
            side: args.side,
            status: 0,
            bump: position_bump,
        },
    )?;

    msg!("Collateral position initialized");
    Ok(())
}

fn deposit_collateral(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    if amount == 0 {
        return Err(EscrowError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;
    let vault_token_account = next_account_info(account_info_iter)?;
    let user_token_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(user)?;
    require_program(token_program, &spl_token::id())?;
    let escrow_config: EscrowConfig = load_with_discriminator(config, "EscrowConfig")?;
    if escrow_config.is_paused {
        return Err(EscrowError::VaultPaused.into());
    }

    let mut collateral_position: CollateralPosition =
        load_with_discriminator(position, "CollateralPosition")?;
    if collateral_position.owner != *user.key
        || collateral_position.escrow_config != *config.key
        || collateral_position.vault_token_account != *vault_token_account.key
    {
        return Err(EscrowError::InvalidAccount.into());
    }

    invoke(
        &token_instruction::transfer(
            token_program.key,
            user_token_account.key,
            vault_token_account.key,
            user.key,
            &[],
            amount,
        )?,
        &[
            user_token_account.clone(),
            vault_token_account.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;

    collateral_position.amount_locked = collateral_position
        .amount_locked
        .checked_add(amount)
        .ok_or(EscrowError::Overflow)?;
    collateral_position.status = 1;
    store_with_discriminator(position, "CollateralPosition", &collateral_position)?;
    msg!("Collateral deposited");
    Ok(())
}

fn release_collateral(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    transfer_out_of_vault(program_id, accounts, amount, false)
}

fn seize_collateral(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    transfer_out_of_vault(program_id, accounts, amount, true)
}

fn transfer_out_of_vault(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    require_liquidation_authority: bool,
) -> ProgramResult {
    if amount == 0 {
        return Err(EscrowError::ZeroAmount.into());
    }

    let account_info_iter = &mut accounts.iter();
    let authority = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let position = next_account_info(account_info_iter)?;
    let vault_token_account = next_account_info(account_info_iter)?;
    let destination_token_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    require_signer(authority)?;
    require_program(token_program, &spl_token::id())?;

    let escrow_config: EscrowConfig = load_with_discriminator(config, "EscrowConfig")?;
    let authorized = if require_liquidation_authority {
        escrow_config.liquidation_authority == *authority.key || escrow_config.admin == *authority.key
    } else {
        escrow_config.admin == *authority.key
    };
    if !authorized {
        return Err(EscrowError::Unauthorized.into());
    }

    let (expected_config, config_bump) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    require_key(config, &expected_config)?;

    let mut collateral_position: CollateralPosition =
        load_with_discriminator(position, "CollateralPosition")?;
    if collateral_position.escrow_config != *config.key
        || collateral_position.vault_token_account != *vault_token_account.key
    {
        return Err(EscrowError::InvalidAccount.into());
    }
    if collateral_position.amount_locked < amount {
        return Err(EscrowError::InvalidStatus.into());
    }

    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            vault_token_account.key,
            destination_token_account.key,
            config.key,
            &[],
            amount,
        )?,
        &[
            vault_token_account.clone(),
            destination_token_account.clone(),
            config.clone(),
            token_program.clone(),
        ],
        &[&[CONFIG_SEED, &[config_bump]]],
    )?;

    collateral_position.amount_locked -= amount;
    collateral_position.status = if collateral_position.amount_locked == 0 {
        if require_liquidation_authority { 3 } else { 2 }
    } else {
        1
    };
    store_with_discriminator(position, "CollateralPosition", &collateral_position)?;

    msg!(
        "{} collateral transferred out",
        if require_liquidation_authority {
            "Seized"
        } else {
            "Released"
        }
    );
    Ok(())
}

fn set_paused(program_id: &Pubkey, accounts: &[AccountInfo], paused: bool) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;

    require_signer(admin)?;
    let mut escrow_config: EscrowConfig = load_with_discriminator(config, "EscrowConfig")?;
    let (expected_config, _) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    require_key(config, &expected_config)?;

    if escrow_config.admin != *admin.key {
        return Err(EscrowError::Unauthorized.into());
    }
    escrow_config.is_paused = paused;
    store_with_discriminator(config, "EscrowConfig", &escrow_config)?;
    msg!("Escrow paused state updated");
    Ok(())
}

fn instruction_discriminator(name: &str) -> [u8; 8] {
    let digest = hash(format!("global:{name}").as_bytes()).to_bytes();
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

fn state_discriminator(name: &str) -> [u8; 8] {
    let digest = hash(format!("account:{name}").as_bytes()).to_bytes();
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

fn store_with_discriminator<T: BorshSerialize>(
    account: &AccountInfo,
    name: &str,
    value: &T,
) -> ProgramResult {
    let mut data = account.try_borrow_mut_data()?;
    let discriminator = state_discriminator(name);
    data[..8].copy_from_slice(&discriminator);
    value.serialize(&mut &mut data[8..])
        .map_err(|_| ProgramError::InvalidAccountData)
}

fn load_with_discriminator<T: BorshDeserialize>(
    account: &AccountInfo,
    name: &str,
) -> Result<T, ProgramError> {
    let data = account.try_borrow_data()?;
    if data.len() < 8 || data[..8] != state_discriminator(name) {
        return Err(ProgramError::InvalidAccountData);
    }
    T::try_from_slice(&data[8..]).map_err(|_| ProgramError::InvalidAccountData)
}

fn create_pda_account<'a>(
    payer: &AccountInfo<'a>,
    new_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    owner: &Pubkey,
    space: usize,
    lamports: u64,
    signer_seeds: &[&[u8]],
) -> ProgramResult {
    if new_account.lamports() > 0 {
        return Ok(());
    }

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            new_account.key,
            lamports,
            space as u64,
            owner,
        ),
        &[payer.clone(), new_account.clone(), system_program.clone()],
        &[signer_seeds],
    )
}

fn require_signer(account: &AccountInfo) -> ProgramResult {
    if !account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

fn require_program(account: &AccountInfo, expected: &Pubkey) -> ProgramResult {
    require_key(account, expected)
}

fn require_key(account: &AccountInfo, expected: &Pubkey) -> ProgramResult {
    if account.key != expected {
        return Err(EscrowError::InvalidAccount.into());
    }
    Ok(())
}
