-- Cusp V1 Protocol Schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/tqrpjhguqkwpxwfmsxmv/sql

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  wallet_address text unique not null,
  kyc_verified boolean default false,
  tier text default 'standard' check (tier in ('standard', 'silver', 'gold', 'platinum')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can read own record"
  on public.users for select
  using (true);

create policy "Users can insert own record"
  on public.users for insert
  with check (true);

create policy "Users can update own record"
  on public.users for update
  using (true);

-- ============================================================
-- PROTOCOL STATE (singleton)
-- ============================================================
create table if not exists public.protocol_state (
  id int primary key default 1 check (id = 1),
  total_tvl numeric default 0,
  cusdc_exchange_rate numeric default 1.0,
  reserve_usdc numeric default 0,
  deployed_usdc numeric default 0,
  total_cusdc_supply numeric default 0,
  loss_reserve numeric default 0,
  protocol_treasury numeric default 0,
  cusdc_mint text,
  vault_public_key text,
  updated_at timestamptz default now()
);

alter table public.protocol_state enable row level security;

create policy "Anyone can read protocol state"
  on public.protocol_state for select
  using (true);

insert into public.protocol_state (id) values (1) on conflict do nothing;

-- ============================================================
-- DEPOSITS
-- ============================================================
create table if not exists public.deposits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  amount_usdc numeric not null check (amount_usdc > 0),
  cusdc_minted numeric not null check (cusdc_minted > 0),
  exchange_rate numeric not null check (exchange_rate > 0),
  tx_signature text,
  mint_tx_signature text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz default now()
);

alter table public.deposits enable row level security;

create policy "Users can read own deposits"
  on public.deposits for select
  using (true);

create policy "Service can insert deposits"
  on public.deposits for insert
  with check (true);

create index idx_deposits_user on public.deposits(user_id);
create index idx_deposits_status on public.deposits(status);

-- ============================================================
-- WITHDRAWALS
-- ============================================================
create table if not exists public.withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  cusdc_amount numeric not null check (cusdc_amount > 0),
  usdc_amount numeric not null check (usdc_amount > 0),
  exchange_rate numeric not null check (exchange_rate > 0),
  withdrawal_type text not null check (withdrawal_type in ('instant', 'queued')),
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  tx_signature text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.withdrawals enable row level security;

create policy "Users can read own withdrawals"
  on public.withdrawals for select
  using (true);

create policy "Service can insert withdrawals"
  on public.withdrawals for insert
  with check (true);

create index idx_withdrawals_user on public.withdrawals(user_id);
create index idx_withdrawals_status on public.withdrawals(status);

-- ============================================================
-- POSITIONS (vault, leveraged, direct)
-- ============================================================
create table if not exists public.positions (
  id uuid default gen_random_uuid() primary key,
  position_type text not null check (position_type in ('vault', 'leveraged', 'direct')),
  user_id uuid references public.users(id),
  market_ticker text not null,
  side text not null check (side in ('YES', 'NO')),
  entry_price numeric not null,
  quantity numeric not null,
  usdc_cost numeric not null,
  outcome_mint text,
  status text default 'open' check (status in ('open', 'closing', 'settled', 'liquidated')),
  created_at timestamptz default now(),
  settled_at timestamptz,
  settlement_payout numeric
);

alter table public.positions enable row level security;

create policy "Anyone can read positions"
  on public.positions for select
  using (true);

create policy "Service can insert positions"
  on public.positions for insert
  with check (true);

create index idx_positions_user on public.positions(user_id);
create index idx_positions_status on public.positions(status);
create index idx_positions_market on public.positions(market_ticker);

-- ============================================================
-- LEVERAGED TRADES
-- ============================================================
create table if not exists public.leveraged_trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  position_id uuid references public.positions(id) not null,
  margin_usdc numeric not null check (margin_usdc > 0),
  borrowed_usdc numeric not null check (borrowed_usdc >= 0),
  leverage numeric not null check (leverage >= 1),
  health_factor numeric default 2.0,
  borrow_rate_bps int default 500,
  accrued_interest numeric default 0,
  status text default 'active' check (status in ('active', 'liquidated', 'closed')),
  created_at timestamptz default now(),
  closed_at timestamptz
);

alter table public.leveraged_trades enable row level security;

create policy "Anyone can read leveraged trades"
  on public.leveraged_trades for select
  using (true);

create policy "Service can insert leveraged trades"
  on public.leveraged_trades for insert
  with check (true);

create index idx_leveraged_user on public.leveraged_trades(user_id);
create index idx_leveraged_status on public.leveraged_trades(status);

-- ============================================================
-- TRADE EXECUTIONS (DFlow order lifecycle)
-- ============================================================
create table if not exists public.trade_executions (
  id uuid default gen_random_uuid() primary key,
  position_id uuid references public.positions(id) not null,
  direction text not null check (direction in ('open', 'close', 'redeem')),
  input_mint text not null,
  output_mint text not null,
  input_amount numeric not null,
  output_amount numeric default 0,
  tx_signature text,
  dflow_order_status text,
  status text default 'pending' check (status in ('pending', 'submitted', 'confirmed', 'failed')),
  created_at timestamptz default now()
);

alter table public.trade_executions enable row level security;

create policy "Anyone can read trade executions"
  on public.trade_executions for select
  using (true);

create policy "Service can insert trade executions"
  on public.trade_executions for insert
  with check (true);

create index idx_executions_position on public.trade_executions(position_id);

-- ============================================================
-- FEES
-- ============================================================
create table if not exists public.fees (
  id uuid default gen_random_uuid() primary key,
  fee_type text not null check (fee_type in ('borrow', 'execution', 'liquidation', 'close', 'platform')),
  amount_usdc numeric not null check (amount_usdc > 0),
  source_id uuid,
  source_type text,
  created_at timestamptz default now()
);

alter table public.fees enable row level security;

create policy "Anyone can read fees"
  on public.fees for select
  using (true);

create index idx_fees_type on public.fees(fee_type);
create index idx_fees_created on public.fees(created_at);

-- ============================================================
-- YIELD DISTRIBUTIONS
-- ============================================================
create table if not exists public.yield_distributions (
  id uuid default gen_random_uuid() primary key,
  period_start timestamptz not null,
  period_end timestamptz not null,
  gross_revenue numeric not null default 0,
  loss_reserve_contribution numeric not null default 0,
  protocol_fee numeric not null default 0,
  net_lp_yield numeric not null default 0,
  exchange_rate_before numeric not null,
  exchange_rate_after numeric not null,
  created_at timestamptz default now()
);

alter table public.yield_distributions enable row level security;

create policy "Anyone can read yield distributions"
  on public.yield_distributions for select
  using (true);

-- ============================================================
-- MARKETS CACHE
-- ============================================================
create table if not exists public.markets_cache (
  ticker text primary key,
  event_ticker text not null,
  title text not null,
  status text not null,
  yes_mint text,
  no_mint text,
  yes_price numeric,
  no_price numeric,
  volume numeric default 0,
  expiration_time bigint,
  data_json jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.markets_cache enable row level security;

create policy "Anyone can read markets cache"
  on public.markets_cache for select
  using (true);

create index idx_markets_status on public.markets_cache(status);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function public.get_or_create_user(p_wallet_address text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from users where wallet_address = p_wallet_address;
  if v_user_id is null then
    insert into users (wallet_address)
    values (p_wallet_address)
    returning id into v_user_id;
  end if;
  return v_user_id;
end;
$$;

grant execute on function public.get_or_create_user(text) to anon;
grant execute on function public.get_or_create_user(text) to authenticated;

create or replace function public.get_protocol_snapshot()
returns json
language sql
security definer
set search_path = public
as $$
  select row_to_json(ps) from (
    select
      total_tvl,
      cusdc_exchange_rate,
      reserve_usdc,
      deployed_usdc,
      total_cusdc_supply,
      loss_reserve,
      protocol_treasury,
      updated_at
    from protocol_state
    where id = 1
  ) ps;
$$;

grant execute on function public.get_protocol_snapshot() to anon;
grant execute on function public.get_protocol_snapshot() to authenticated;

create or replace function public.get_user_portfolio(p_wallet_address text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result json;
begin
  select id into v_user_id from users where wallet_address = p_wallet_address;
  if v_user_id is null then
    return json_build_object(
      'deposits', json_build_array(),
      'positions', json_build_array(),
      'leveraged_trades', json_build_array(),
      'total_deposited', 0,
      'total_cusdc', 0
    );
  end if;

  select json_build_object(
    'deposits', coalesce((
      select json_agg(row_to_json(d))
      from deposits d where d.user_id = v_user_id and d.status = 'confirmed'
    ), '[]'::json),
    'positions', coalesce((
      select json_agg(row_to_json(p))
      from positions p where p.user_id = v_user_id and p.status = 'open'
    ), '[]'::json),
    'leveraged_trades', coalesce((
      select json_agg(row_to_json(lt))
      from leveraged_trades lt where lt.user_id = v_user_id and lt.status = 'active'
    ), '[]'::json),
    'total_deposited', coalesce((
      select sum(d.amount_usdc) from deposits d
      where d.user_id = v_user_id and d.status = 'confirmed'
    ), 0),
    'total_cusdc', coalesce((
      select sum(d.cusdc_minted) from deposits d
      where d.user_id = v_user_id and d.status = 'confirmed'
    ), 0) - coalesce((
      select sum(w.cusdc_amount) from withdrawals w
      where w.user_id = v_user_id and w.status = 'completed'
    ), 0)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_user_portfolio(text) to anon;
grant execute on function public.get_user_portfolio(text) to authenticated;

-- ============================================================
-- REALTIME (enable for live updates)
-- ============================================================
alter publication supabase_realtime add table public.protocol_state;
alter publication supabase_realtime add table public.positions;
alter publication supabase_realtime add table public.deposits;
alter publication supabase_realtime add table public.withdrawals;
alter publication supabase_realtime add table public.leveraged_trades;
