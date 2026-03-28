# DFlow API Integration

## Overview

Cusp now uses **live data** from DFlow's Metadata API for markets and aggregates. The following APIs are integrated:

| Service | Base URL | Usage |
|---------|----------|-------|
| **Metadata API** | `https://dev-prediction-markets-api.dflow.net` | Markets, events, categories |
| **Trade API** | `https://dev-quote-api.dflow.net` | Swaps, orders (for future trading) |
| **Metadata API WebSocket** | `wss://dev-prediction-markets-api.dflow.net/api/v1/ws` | Live prices, orderbook, trades |
| **Trade API WebSocket** | `wss://dev-quote-api.dflow.net/priority-fees/stream` | Priority fee streaming |

## What's Live vs Mock

### Live (from DFlow)
- **Markets page** — All markets from `GET /api/v1/markets?status=active`
- **Index page** — Top 4 high-probability markets, total volume, active markets count
- **Market Detail page** — Live prices, orderbook, and trades via WebSocket (`prices`, `orderbook`, `trades` channels)
- **Categories** — Crypto, Sports, Politics, Economics, Finance, Other (inferred from market data)

### Still Mocked (Cusp-specific, needs backend)
- **Vault stats** — TVL, APY, positions (Cusp vault product)
- **Vault positions** — User's vault share positions
- **Lend / Active loans** — User's borrowed positions
- **Portfolio** — User's deposits, borrows, yield earned

## API Client

Location: `src/lib/dflow-api.ts`

### Key functions
- `fetchMarkets(params)` — List markets with status/limit filters
- `fetchEvents(params)` — List events
- `fetchTagsByCategories()` — Category tags for filtering
- `dflowMarketToCusp(m)` — Transform DFlow market → Cusp UI format

### React Query hooks
Location: `src/hooks/useDflowMarkets.ts`

- `useDflowMarkets(params)` — Active markets with 30s stale time
- `useDflowEvents(limit)` — Events list
- `useDflowTags()` — Category tags
- `useDflowMarketStats()` — Aggregated stats (count, volume)

## DFlow Market Data Model

Markets include:
- `ticker`, `eventTicker`, `title`, `status`
- `yesBid`, `yesAsk`, `noBid`, `noAsk` (prices as strings, e.g. `"0.99"`)
- `volume`, `volume24h`, `openInterest`
- `expirationTime` (Unix timestamp)
- `accounts` — Per settlement mint: `yesMint`, `noMint`, `marketLedger`

## Production

For production:
1. Apply for an API key at [pond.dflow.net/build/api-key](https://pond.dflow.net/build/api-key)
2. Use production endpoints (replace `dev-` with prod URLs)
3. Add `Authorization: Bearer <key>` header to requests
4. Dev endpoints are rate-limited; production has higher limits

## Next Steps

1. **Trading** — Integrate Trade API `/order` for buying/selling outcome tokens
2. **User positions** — Query wallet token accounts, map mints to markets via `filter_outcome_mints`
3. **Vault/Lend** — Build Cusp backend + indexer for vault TVL, user positions, loans
