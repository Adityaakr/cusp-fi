-- Additional protocol helper functions

create or replace function public.update_protocol_after_deposit(
  p_amount_usdc numeric,
  p_cusdc_minted numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update protocol_state
  set
    total_tvl = total_tvl + p_amount_usdc,
    reserve_usdc = reserve_usdc + p_amount_usdc,
    total_cusdc_supply = total_cusdc_supply + p_cusdc_minted,
    updated_at = now()
  where id = 1;
end;
$$;

grant execute on function public.update_protocol_after_deposit(numeric, numeric) to service_role;
