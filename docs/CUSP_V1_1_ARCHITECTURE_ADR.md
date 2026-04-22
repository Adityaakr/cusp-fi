# CUSP v1.1 Architecture ADR

Status: accepted for implementation  
Date: 2026-04-21  
Source delta: `../CUSP_ARCHITECTURE_CHANGES.md`

## Decision

CUSP v1.1 moves the protocol from a single-vault, hard-expiry lending design to a tiered risk architecture with cleaner liquidation mechanics:

1. **Opposite-token liquidation**: liquidations buy the opposite outcome, merge YES+NO, redeem to USDC, repay the loan, then return borrower surplus.
2. **Linear early closure**: the liquidation threshold decays linearly over the final 7 days before resolution instead of force-closing everything at T-2h.
3. **Three isolated LP funds**: Conservative, Moderate, and Growth vaults each have their own cUSDC mint, reserve, accounting, and market eligibility.

This ADR is the implementation baseline for `cusp-fi`. Older V1/Vault+Enroll docs remain useful historical context, but implementation should follow this document unless a newer ADR supersedes it.

## Repo mapping

The architecture change document uses final protocol names. The current repo maps those names as follows:

| Architecture name | Current repo implementation |
| --- | --- |
| `cusp_lend.so` | `programs/cusp-leverage` |
| `cusp_vault.so` | `programs/cusp-vault` |
| `collateral_registry` | new market config/registry state in `cusp-leverage`, mirrored in Supabase `markets_cache` |
| `hard_expiry.so` | removed; replaced by shared early-closure formulas in app, Edge Functions, and contracts |
| keeper bot | Supabase Edge Functions now, dedicated keeper later |

Contracts **never call DFlow or HTTP directly**. Contracts enforce custody, tier routing, account state, and accounting. Supabase Edge Functions / keeper processes build and submit DFlow transactions, then settle the resulting state on-chain and in Supabase.

## Public interfaces and constants

### Risk tiers

| Tier | cUSDC mint label | Eligibility at registration | Interest cap | Target LP APY | Reserve |
| --- | --- | --- | --- | --- | --- |
| Conservative | `cUSDC-C` | probability `> 85%` | 10% | 8-12% | 25% |
| Moderate | `cUSDC-M` | `65% <= probability <= 85%` | 20% | 12-18% | 25% |
| Growth | `cUSDC-G` | `50% <= probability < 65%` | 30% | 18-28% | 25% |
| Ineligible | n/a | probability `< 50%` | n/a | n/a | n/a |

Markets are assigned exactly one tier at registration. If probability later crosses a boundary, the registry may be updated for new loans; outstanding loans keep their original tier.

### Early closure

Shared constants:

```ts
EARLY_CLOSURE_WINDOW_SECONDS = 604800 // 7 days
MIN_RESERVE_BPS = 2500               // 25%
```

Formula:

```ts
if current_time >= resolution_time: threshold = 0
else if resolution_time - current_time >= 604800: threshold = base_threshold
else threshold = base_threshold * (resolution_time - current_time) / 604800
```

Liquidation uses the effective threshold in every surface: borrow UI, risk checks, keeper scans, and on-chain liquidation guards.

### DFlow liquidation dependency

Primary path assumes a private DFlow endpoint:

```http
POST /trade/merge
```

Required keeper flow:

1. Read position collateral and market config.
2. Buy the opposite token via DFlow Trade API.
3. Merge equal YES+NO quantities through the private merge endpoint.
4. Redeem merged pairs to USDC.
5. Repay principal + accrued interest.
6. Return surplus to borrower; record shortfall if proceeds are insufficient.

Public DFlow references retained in docs:

- Trading API introduction: https://pond.dflow.net/build/trading-api/introduction
- `/order`: https://pond.dflow.net/build/trading-api/order/order
- Redeem outcome tokens recipe: https://pond.dflow.net/build/recipes/prediction-markets/redeem-outcome-tokens

If the private merge endpoint is unavailable, the documented fallback is to hold the opposite leg and redeem after resolution. That fallback is not the primary v1.1 implementation target.

## Contract design

### `programs/cusp-vault`

- One `VaultState` PDA per risk tier using tier-specific seeds.
- One cUSDC mint per tier:
  - Conservative: `cUSDC-C`
  - Moderate: `cUSDC-M`
  - Growth: `cUSDC-G`
- Each vault tracks independent `total_usdc_managed`, `total_cusdc_supply`, `total_deployed`, pause state, and reserve.
- `deploy_funds` enforces 25% minimum available reserve for that tier only.
- No capital sharing across tiers.

### `programs/cusp-leverage`

- Adds market config accounts keyed by market ticker.
- Market config stores YES mint, NO mint, settlement mint, fund tier, base liquidation threshold, early-closure flag, and resolution time.
- `open_position` validates that the selected side matches the market config and that the supplied vault account matches the market tier.
- Outcome tokens are held in protocol-controlled escrow after fill.
- Liquidation is split into deterministic phases:
  - `start_liquidation`: validates effective threshold and moves position to liquidating state.
  - keeper executes DFlow buy/merge/redeem off-chain.
  - `settle_liquidation`: records proceeds, repayment, surplus/shortfall, and final status.

Devnet reset/redeploy is allowed, so these layouts intentionally do not preserve old PDA/account compatibility.

## Supabase / keeper design

- `markets_cache` mirrors tier and early-closure fields from the market registry.
- `leveraged_trades` stores vault tier, collateral mint/amount, effective threshold, and liquidation execution status.
- `risk-check` returns tier and early-closure metadata with approval results.
- `liquidate` uses the DFlow adapter sequence: order opposite token, merge, redeem, then record settlement.
- External notifications are out of scope for the first implementation. The app shows in-product T-7d/T-3d/T-1d warning states.

## Frontend design

- Markets display fund tier and early-closure state where applicable.
- Borrow UI replaces hard-expiry language with a threshold countdown and 7-day schedule.
- Vault UI uses a fund selector and per-fund TVL/APY/liquidity cards.
- Aggregate dashboard stats are computed from the three isolated funds.
- Legacy single-vault balances are displayed as fallback if tier data is unavailable during devnet transition.

## Test requirements

- Unit-test early-closure formula at outside-window, 7d, halfway, 1d, at-resolution, and past-resolution boundaries.
- Unit-test tier assignment at 85%, 85.01%, 65%, 64.99%, 50%, and <50%.
- Contract-test three vault initialization, isolated deposits/withdrawals, 25% reserve enforcement, tier-matched borrowing, escrowed outcome tokens, and liquidation settlement.
- Backend-test risk-check metadata and DFlow buy/merge/redeem call order.
