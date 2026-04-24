-- 007_invite_codes.sql
-- Supabase-backed invite code system.
-- Codes are pre-seeded, one-time use, and bound to a wallet address on redemption.
-- The table is fully locked behind RLS with zero policies; all access goes
-- through SECURITY DEFINER RPCs so the anon key can never read raw codes.

-- 1. Table
CREATE TABLE public.invite_codes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code            text NOT NULL UNIQUE,
  wallet_address  text DEFAULT NULL,
  used            boolean DEFAULT false,
  used_at         timestamptz DEFAULT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_invite_codes_wallet ON public.invite_codes (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX idx_invite_codes_code_unused ON public.invite_codes (code) WHERE used = false;

-- 2. RLS — enabled with zero policies so anon/authenticated cannot touch the table directly
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- 3. RPC: verify_invite_code
--    If the wallet already redeemed a code, returns true immediately.
--    Otherwise attempts to claim the supplied code for this wallet.
CREATE OR REPLACE FUNCTION public.verify_invite_code(
  p_wallet_address text,
  p_code text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM invite_codes
    WHERE wallet_address = p_wallet_address AND used = true
    LIMIT 1;
  IF FOUND THEN RETURN true; END IF;

  UPDATE invite_codes
    SET used = true, wallet_address = p_wallet_address, used_at = now()
    WHERE code = p_code AND used = false
    RETURNING id INTO v_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_invite_code TO anon, authenticated;

-- 4. RPC: check_wallet_access
--    Quick boolean check — has this wallet already redeemed any code?
CREATE OR REPLACE FUNCTION public.check_wallet_access(
  p_wallet_address text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM invite_codes
    WHERE wallet_address = p_wallet_address AND used = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_wallet_access TO anon, authenticated;

-- 5. Seed 200 invite codes (format: CUSP-XXXXXX, 6 uppercase alphanumeric chars)
CREATE OR REPLACE FUNCTION _generate_invite_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := 'CUSP-';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

INSERT INTO public.invite_codes (code)
SELECT DISTINCT _generate_invite_code()
FROM generate_series(1, 300)
LIMIT 200;

DROP FUNCTION _generate_invite_code();
