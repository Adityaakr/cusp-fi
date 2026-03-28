-- 004_exchange_rate_history.sql
-- Stores exchange rate snapshots for the cUSDC history chart.
-- Trigger auto-snapshots whenever protocol_state is updated.

CREATE TABLE IF NOT EXISTS exchange_rate_snapshots (
  id bigint generated always as identity primary key,
  exchange_rate numeric(12,6) not null default 1.0,
  total_tvl numeric(18,2) not null default 0,
  total_cusdc_supply numeric(18,6) not null default 0,
  snapped_at timestamptz not null default now()
);

ALTER TABLE exchange_rate_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read snapshots" ON exchange_rate_snapshots
  FOR SELECT USING (true);

CREATE INDEX idx_snapshots_time ON exchange_rate_snapshots (snapped_at DESC);

CREATE OR REPLACE FUNCTION snapshot_exchange_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cusdc_exchange_rate IS DISTINCT FROM OLD.cusdc_exchange_rate
     OR NEW.total_tvl IS DISTINCT FROM OLD.total_tvl THEN
    INSERT INTO exchange_rate_snapshots (exchange_rate, total_tvl, total_cusdc_supply)
    VALUES (NEW.cusdc_exchange_rate, NEW.total_tvl, NEW.total_cusdc_supply);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_exchange_rate
  AFTER UPDATE ON protocol_state
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_exchange_rate();

CREATE OR REPLACE FUNCTION public.get_exchange_rate_history(p_days int default 90)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.snapped_at), '[]'::json)
  FROM (
    SELECT exchange_rate, total_tvl, snapped_at
    FROM exchange_rate_snapshots
    WHERE snapped_at >= now() - (p_days || ' days')::interval
    ORDER BY snapped_at
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_exchange_rate_history TO anon, authenticated;

-- Seed initial snapshot
INSERT INTO exchange_rate_snapshots (exchange_rate, total_tvl, total_cusdc_supply)
VALUES (1.0, 0, 0);
