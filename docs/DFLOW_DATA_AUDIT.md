# DFlow API Data Audit

## What We Use vs What We're Missing

### Markets API (`/api/v1/markets`, `/api/v1/market/:ticker`)

| Field | Used? | Where | Notes |
|-------|-------|-------|-------|
| `ticker` | ✅ | Everywhere | Market ID |
| `eventTicker` | ✅ | CuspMarket, category inference | |
| `title` | ✅ | Market name | |
| `subtitle` | ❌ | — | Extra context; could show on detail page |
| `yesSubTitle` | ❌ → ✅ | — | **Critical**: "Real Madrid" for Man City vs Real Madrid. Use instead of "YES" |
| `noSubTitle` | ❌ → ✅ | — | Often same as yesSubTitle in API; derive NO label from title when same |
| `marketType` | ❌ | — | "binary" etc.; could filter or display |
| `yesBid`, `yesAsk`, `noBid`, `noAsk` | ✅ | Prices | |
| `volume`, `volume24h` | ✅ | Stats | |
| `openInterest` | ❌ | — | **Valuable**: Total $ at stake; add to detail page |
| `expirationTime` | ✅ | Resolution date | |
| `openTime`, `closeTime` | ❌ | — | Could show market lifecycle |
| `status` | ✅ | Filtering | |
| `result` | ❌ | — | Resolution outcome when resolved |
| `rulesPrimary`, `rulesSecondary` | ❌ | — | **Valuable**: Resolution rules; add to detail page |
| `earlyCloseCondition` | ❌ | — | Could show when market can close early |
| `fractionalTradingEnabled`, `canCloseEarly` | ❌ | — | Feature flags |
| `accounts` (yesMint, noMint) | ✅ | Trading | |

### Orderbook API

| Field | Used? | Notes |
|-------|-------|-------|
| `yes_bids`, `no_bids` | ✅ | |
| `yes_asks`, `no_asks` | ❌ | Could show ask side for completeness |
| `sequence` | ❌ | For ordering/deduplication |

### Candlesticks API

| Field | Used? | Notes |
|-------|-------|-------|
| `yes_ask.close_dollars` etc. | ✅ | |
| `volume` per candle | ❌ | Could add volume bars to chart |

### Events API

| Field | Used? | Notes |
|-------|-------|-------|
| `imageUrl` | ❌ | Event image; could show on cards |
| `competition`, `competitionScope` | ❌ | Event metadata |
| `liquidity` | ❌ | Per-event liquidity |

### WebSocket (prices, orderbook, trades)

| Channel | Used? | Notes |
|---------|-------|-------|
| `prices` | ✅ | Live YES/NO |
| `orderbook` | ✅ | Live depth |
| `trades` | ✅ | Live chart ticks |

---

## High-Impact Additions

1. **yesSubTitle / noSubTitle** → Replace "YES"/"NO" with "Real Madrid"/"Man City" etc.
2. **rulesPrimary** → Show resolution rules on market detail
3. **openInterest** → Add to stats bar
4. **subtitle** → Optional context under title
