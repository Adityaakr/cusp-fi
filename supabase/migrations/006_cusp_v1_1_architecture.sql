-- CUSP v1.1 architecture migration: tiered vaults, early closure, and merge liquidation tracking.

-- ---------- shared enum-like constraints ----------
create table if not exists public.vault_funds (
  tier text primary key check (tier in ('conservative', 'moderate', 'growth')),
  label text not null,
  cusdc_symbol text not null unique,
  interest_cap_bps int not null,
  target_apy_min numeric not null,
  target_apy_max numeric not null,
  min_reserve_bps int not null default 2500,
  total_tvl numeric not null default 0,
  reserve_usdc numeric not null default 0,
  deployed_usdc numeric not null default 0,
  total_cusdc_supply numeric not null default 0,
  cusdc_exchange_rate numeric not null default 1,
  is_paused boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.vault_funds (tier, label, cusdc_symbol, interest_cap_bps, target_apy_min, target_apy_max)
values
  ('conservative', 'Conservative', 'cUSDC-C', 1000, 8, 12),
  ('moderate', 'Moderate', 'cUSDC-M', 2000, 12, 18),
  ('growth', 'Growth', 'cUSDC-G', 3000, 18, 28)
on conflict (tier) do update set
  label = excluded.label,
  cusdc_symbol = excluded.cusdc_symbol,
  interest_cap_bps = excluded.interest_cap_bps,
  target_apy_min = excluded.target_apy_min,
  target_apy_max = excluded.target_apy_max,
  min_reserve_bps = 2500,
  updated_at = now();

alter table public.vault_funds enable row level security;

do $$ begin
  create policy "Anyone can read vault funds" on public.vault_funds for select using (true);
exception when duplicate_object then null;
end $$;

-- ---------- market registry mirror ----------
alter table public.markets_cache
  add column if not exists fund_tier text check (fund_tier in ('conservative', 'moderate', 'growth', 'ineligible')) default 'ineligible',
  add column if not exists early_closure_enabled boolean not null default true,
  add column if not exists base_liquidation_threshold_bps int not null default 7700,
  add column if not exists resolution_time bigint,
  add column if not exists settlement_mint text;

update public.markets_cache
set resolution_time = coalesce(resolution_time, expiration_time)
where resolution_time is null;

create index if not exists idx_markets_fund_tier on public.markets_cache(fund_tier);
create index if not exists idx_markets_resolution_time on public.markets_cache(resolution_time);

-- ---------- user deposits / withdrawals by fund ----------
alter table public.deposits
  add column if not exists deposit_type text check (deposit_type in ('vault', 'trading_pool')) default 'vault',
  add column if not exists vault_tier text check (vault_tier in ('conservative', 'moderate', 'growth')) default 'conservative';

alter table public.withdrawals
  add column if not exists vault_tier text check (vault_tier in ('conservative', 'moderate', 'growth')) default 'conservative';

-- ---------- positions and loans ----------
alter table public.positions
  add column if not exists vault_tier text check (vault_tier in ('conservative', 'moderate', 'growth')),
  add column if not exists early_closure_enabled boolean not null default true,
  add column if not exists base_liquidation_threshold_bps int not null default 7700,
  add column if not exists effective_liquidation_threshold_bps int;

alter table public.leveraged_trades
  add column if not exists vault_tier text check (vault_tier in ('conservative', 'moderate', 'growth')),
  add column if not exists collateral_mint text,
  add column if not exists collateral_amount numeric not null default 0,
  add column if not exists effective_liquidation_threshold_bps int not null default 7700,
  add column if not exists liquidation_execution_status text not null default 'none'
    check (liquidation_execution_status in ('none', 'eligible', 'started', 'merge_redeem_built', 'settled', 'failed')),
  add column if not exists liquidation_started_at timestamptz,
  add column if not exists liquidation_settled_at timestamptz,
  add column if not exists liquidation_proceeds_usdc numeric,
  add column if not exists liquidation_surplus_usdc numeric,
  add column if not exists liquidation_shortfall_usdc numeric;

create index if not exists idx_leveraged_vault_tier on public.leveraged_trades(vault_tier);
create index if not exists idx_leveraged_liquidation_status on public.leveraged_trades(liquidation_execution_status);

-- ---------- liquidation execution directions ----------
do $$
begin
  alter table public.trade_executions drop constraint if exists trade_executions_direction_check;
  alter table public.trade_executions add constraint trade_executions_direction_check
    check (direction in (
      'open',
      'close',
      'redeem',
      'liquidation_buy_opposite',
      'liquidation_merge',
      'liquidation_redeem'
    ));
end $$;

-- ---------- tiered protocol snapshot helper ----------
create or replace function public.get_v1_1_protocol_snapshot()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'funds', coalesce((select json_object_agg(tier, row_to_json(vf)) from vault_funds vf), '{}'::json),
    'aggregate', (
      select json_build_object(
        'total_tvl', coalesce(sum(total_tvl), 0),
        'reserve_usdc', coalesce(sum(reserve_usdc), 0),
        'deployed_usdc', coalesce(sum(deployed_usdc), 0),
        'total_cusdc_supply', coalesce(sum(total_cusdc_supply), 0),
        'updated_at', max(updated_at)
      )
      from vault_funds
    )
  );
$$;

grant execute on function public.get_v1_1_protocol_snapshot() to anon;
grant execute on function public.get_v1_1_protocol_snapshot() to authenticated;

alter publication supabase_realtime add table public.vault_funds;
