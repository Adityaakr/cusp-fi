-- Record a direct trade position and its execution in a single call.
-- Called from the frontend after a DFlow direct trade is signed and confirmed.

create or replace function public.record_direct_trade(
  p_wallet_address text,
  p_market_ticker text,
  p_side text,
  p_usdc_amount numeric,
  p_output_mint text,
  p_tx_signature text,
  p_entry_price numeric default 0,
  p_quantity numeric default 0
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_position_id uuid;
begin
  -- Get or create user
  select id into v_user_id from users where wallet_address = p_wallet_address;
  if v_user_id is null then
    insert into users (wallet_address)
    values (p_wallet_address)
    returning id into v_user_id;
  end if;

  -- Insert position
  insert into positions (
    position_type, user_id, market_ticker, side,
    entry_price, quantity, usdc_cost, outcome_mint, status
  )
  values (
    'direct', v_user_id, p_market_ticker, p_side,
    coalesce(p_entry_price, 0), coalesce(p_quantity, 0),
    p_usdc_amount, p_output_mint, 'open'
  )
  returning id into v_position_id;

  -- Record trade execution
  insert into trade_executions (
    position_id, direction, input_mint, output_mint,
    input_amount, tx_signature, status
  )
  values (
    v_position_id, 'open',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    p_output_mint, p_usdc_amount, p_tx_signature, 'confirmed'
  );

  return json_build_object(
    'position_id', v_position_id,
    'user_id', v_user_id,
    'tx_signature', p_tx_signature
  );
end;
$$;

grant execute on function public.record_direct_trade(text, text, text, numeric, text, text, numeric, numeric) to anon;
grant execute on function public.record_direct_trade(text, text, text, numeric, text, text, numeric, numeric) to authenticated;
grant execute on function public.record_direct_trade(text, text, text, numeric, text, text, numeric, numeric) to service_role;
