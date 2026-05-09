-- Mainnet outcome lending architecture
-- Keeps the existing devnet vault demo intact while adding a separate
-- mainnet trading pool + outcome-token collateral loan book.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  wallet_address text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

do $$ begin
  create policy "Anyone can read users"
    on public.users for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage users"
    on public.users for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create table if not exists public.lending_pools (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  name text not null,
  pool_type text not null check (pool_type in ('demo_vault', 'mainnet_trading')),
  asset_mint text not null,
  authority_wallet text,
  total_deposited numeric not null default 0 check (total_deposited >= 0),
  available_liquidity numeric not null default 0 check (available_liquidity >= 0),
  borrowed_liquidity numeric not null default 0 check (borrowed_liquidity >= 0),
  reserve_target_bps int not null default 2000 check (reserve_target_bps >= 0 and reserve_target_bps <= 10000),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lending_pools enable row level security;

do $$ begin
  create policy "Anyone can read lending pools"
    on public.lending_pools for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage lending pools"
    on public.lending_pools for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

insert into public.lending_pools (
  slug,
  name,
  pool_type,
  asset_mint
)
values (
  'mainnet-outcome-usdc',
  'Mainnet Outcome USDC Pool',
  'mainnet_trading',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
)
on conflict (slug) do nothing;

create table if not exists public.subvaults (
  id uuid default gen_random_uuid() primary key,
  pool_id uuid not null references public.lending_pools(id) on delete cascade,
  slug text not null unique,
  risk_tier text not null check (risk_tier in ('low', 'medium', 'high')),
  max_allocation_bps int not null check (max_allocation_bps >= 0 and max_allocation_bps <= 10000),
  current_allocation numeric not null default 0 check (current_allocation >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subvaults enable row level security;

do $$ begin
  create policy "Anyone can read subvaults"
    on public.subvaults for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage subvaults"
    on public.subvaults for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

insert into public.subvaults (pool_id, slug, risk_tier, max_allocation_bps)
select id, 'mainnet-outcome-low', 'low', 1000
from public.lending_pools
where slug = 'mainnet-outcome-usdc'
on conflict (slug) do nothing;

insert into public.subvaults (pool_id, slug, risk_tier, max_allocation_bps)
select id, 'mainnet-outcome-medium', 'medium', 500
from public.lending_pools
where slug = 'mainnet-outcome-usdc'
on conflict (slug) do nothing;

insert into public.subvaults (pool_id, slug, risk_tier, max_allocation_bps)
select id, 'mainnet-outcome-high', 'high', 200
from public.lending_pools
where slug = 'mainnet-outcome-usdc'
on conflict (slug) do nothing;

create table if not exists public.market_registry (
  id uuid default gen_random_uuid() primary key,
  market_ticker text not null unique,
  event_ticker text,
  yes_mint text not null,
  no_mint text not null,
  resolution_time bigint,
  status text not null default 'unknown',
  category text,
  settlement_mint text default 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  current_risk_score numeric,
  current_risk_tier text check (current_risk_tier in ('low', 'medium', 'high', 'ineligible')),
  max_ltv_bps int check (max_ltv_bps >= 0 and max_ltv_bps <= 10000),
  liquidation_threshold_bps int check (liquidation_threshold_bps >= 0 and liquidation_threshold_bps <= 10000),
  max_pool_allocation_bps int check (max_pool_allocation_bps >= 0 and max_pool_allocation_bps <= 10000),
  subvault_id uuid references public.subvaults(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_registry enable row level security;

do $$ begin
  create policy "Anyone can read market registry"
    on public.market_registry for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage market registry"
    on public.market_registry for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists idx_market_registry_tier on public.market_registry(current_risk_tier);
create index if not exists idx_market_registry_resolution on public.market_registry(resolution_time);

create table if not exists public.lp_positions (
  id uuid default gen_random_uuid() primary key,
  pool_id uuid not null references public.lending_pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_address text not null,
  deposited_amount numeric not null default 0 check (deposited_amount >= 0),
  available_amount numeric not null default 0 check (available_amount >= 0),
  locked_amount numeric not null default 0 check (locked_amount >= 0),
  earned_fees numeric not null default 0 check (earned_fees >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, user_id)
);

alter table public.lp_positions enable row level security;

do $$ begin
  create policy "Anyone can read lp positions"
    on public.lp_positions for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage lp positions"
    on public.lp_positions for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists idx_lp_positions_pool on public.lp_positions(pool_id);

create table if not exists public.collateral_lots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_address text not null,
  market_registry_id uuid not null references public.market_registry(id) on delete restrict,
  market_ticker text not null,
  side text not null check (side in ('YES', 'NO')),
  mint text not null,
  quantity numeric not null check (quantity > 0),
  escrow_token_account text,
  deposit_tx_signature text,
  snapshot_price numeric not null check (snapshot_price >= 0),
  snapshot_value_usdc numeric not null check (snapshot_value_usdc >= 0),
  risk_score numeric,
  risk_tier text not null check (risk_tier in ('low', 'medium', 'high', 'ineligible')),
  max_ltv_bps int not null check (max_ltv_bps >= 0 and max_ltv_bps <= 10000),
  liquidation_threshold_bps int not null check (liquidation_threshold_bps >= 0 and liquidation_threshold_bps <= 10000),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'locked', 'released', 'liquidated')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collateral_lots enable row level security;

do $$ begin
  create policy "Anyone can read collateral lots"
    on public.collateral_lots for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage collateral lots"
    on public.collateral_lots for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists idx_collateral_lots_user on public.collateral_lots(user_id);
create index if not exists idx_collateral_lots_market on public.collateral_lots(market_ticker);
create index if not exists idx_collateral_lots_status on public.collateral_lots(status);

create table if not exists public.outcome_loans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_address text not null,
  pool_id uuid not null references public.lending_pools(id) on delete restrict,
  subvault_id uuid references public.subvaults(id) on delete restrict,
  collateral_lot_id uuid not null unique references public.collateral_lots(id) on delete restrict,
  principal_usdc numeric not null check (principal_usdc > 0),
  borrowed_amount_usdc numeric not null check (borrowed_amount_usdc > 0),
  accrued_interest_usdc numeric not null default 0 check (accrued_interest_usdc >= 0),
  interest_bps int not null default 500 check (interest_bps >= 0 and interest_bps <= 100000),
  max_ltv_bps int not null check (max_ltv_bps >= 0 and max_ltv_bps <= 10000),
  liquidation_threshold_bps int not null check (liquidation_threshold_bps >= 0 and liquidation_threshold_bps <= 10000),
  health_factor numeric,
  borrow_tx_signature text,
  repay_tx_signature text,
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'repaid', 'liquidating', 'liquidated', 'defaulted')),
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.outcome_loans enable row level security;

do $$ begin
  create policy "Anyone can read outcome loans"
    on public.outcome_loans for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage outcome loans"
    on public.outcome_loans for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists idx_outcome_loans_user on public.outcome_loans(user_id);
create index if not exists idx_outcome_loans_status on public.outcome_loans(status);
create index if not exists idx_outcome_loans_pool on public.outcome_loans(pool_id);

create table if not exists public.collateral_price_snapshots (
  id uuid default gen_random_uuid() primary key,
  collateral_lot_id uuid not null references public.collateral_lots(id) on delete cascade,
  market_ticker text not null,
  price numeric not null check (price >= 0),
  value_usdc numeric not null check (value_usdc >= 0),
  risk_score numeric,
  captured_at timestamptz not null default now()
);

alter table public.collateral_price_snapshots enable row level security;

do $$ begin
  create policy "Anyone can read collateral price snapshots"
    on public.collateral_price_snapshots for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage collateral price snapshots"
    on public.collateral_price_snapshots for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists idx_collateral_price_snapshots_lot on public.collateral_price_snapshots(collateral_lot_id, captured_at desc);

create table if not exists public.liquidation_events (
  id uuid default gen_random_uuid() primary key,
  outcome_loan_id uuid not null references public.outcome_loans(id) on delete cascade,
  collateral_lot_id uuid not null references public.collateral_lots(id) on delete cascade,
  reason text not null check (reason in ('ltv_breach', 'expiry', 'market_halt', 'manual_risk_off')),
  trigger_price numeric,
  collateral_value_usdc numeric,
  recovered_usdc numeric,
  status text not null default 'queued' check (status in ('queued', 'started', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.liquidation_events enable row level security;

do $$ begin
  create policy "Anyone can read liquidation events"
    on public.liquidation_events for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service can manage liquidation events"
    on public.liquidation_events for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists idx_liquidation_events_status on public.liquidation_events(status);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lending_pools_updated_at on public.lending_pools;
create trigger trg_lending_pools_updated_at
before update on public.lending_pools
for each row execute function public.touch_updated_at();

drop trigger if exists trg_subvaults_updated_at on public.subvaults;
create trigger trg_subvaults_updated_at
before update on public.subvaults
for each row execute function public.touch_updated_at();

drop trigger if exists trg_market_registry_updated_at on public.market_registry;
create trigger trg_market_registry_updated_at
before update on public.market_registry
for each row execute function public.touch_updated_at();

drop trigger if exists trg_lp_positions_updated_at on public.lp_positions;
create trigger trg_lp_positions_updated_at
before update on public.lp_positions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_collateral_lots_updated_at on public.collateral_lots;
create trigger trg_collateral_lots_updated_at
before update on public.collateral_lots
for each row execute function public.touch_updated_at();

drop trigger if exists trg_outcome_loans_updated_at on public.outcome_loans;
create trigger trg_outcome_loans_updated_at
before update on public.outcome_loans
for each row execute function public.touch_updated_at();
