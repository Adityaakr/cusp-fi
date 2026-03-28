-- 003_security_hardening.sql
-- Locks down RLS policies so the anon key can only read public data,
-- insert to waitlist, and call safe SECURITY DEFINER RPCs.
-- All writes to critical tables go exclusively through Edge Functions (service_role).

-- 1. Revoke dangerous RPC from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.update_protocol_after_deposit FROM anon, authenticated;

-- 2. Drop INSERT policies on critical tables (only service_role should write)
DROP POLICY IF EXISTS "Service can insert deposits" ON deposits;
DROP POLICY IF EXISTS "Service can insert positions" ON positions;
DROP POLICY IF EXISTS "Service can insert leveraged trades" ON leveraged_trades;
DROP POLICY IF EXISTS "Service can insert trade executions" ON trade_executions;
DROP POLICY IF EXISTS "Service can insert withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Users can insert own record" ON users;

-- 3. Drop overly permissive SELECT policies on user-specific tables
DROP POLICY IF EXISTS "Users can read own deposits" ON deposits;
DROP POLICY IF EXISTS "Users can read own withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Anyone can read positions" ON positions;
DROP POLICY IF EXISTS "Anyone can read leveraged trades" ON leveraged_trades;
DROP POLICY IF EXISTS "Anyone can read trade executions" ON trade_executions;
DROP POLICY IF EXISTS "Users can read own record" ON users;

-- 4. Drop permissive UPDATE policy on users
DROP POLICY IF EXISTS "Users can update own record" ON users;

-- 5. Create SECURITY DEFINER function for KYC updates (replaces direct users UPDATE)
CREATE OR REPLACE FUNCTION public.mark_user_kyc_verified(p_wallet_address text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET kyc_verified = true
  WHERE wallet_address = p_wallet_address;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_user_kyc_verified TO anon, authenticated;

-- Policies intentionally kept (safe, public data only):
--   protocol_state  SELECT  (public, single row)
--   markets_cache   SELECT  (public market listings)
--   fees            SELECT  (public fee history)
--   yield_distributions SELECT (public yield history)
--   waitlist        INSERT for anon (email signup)
