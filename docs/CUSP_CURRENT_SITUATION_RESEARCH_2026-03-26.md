# CUSP Current Situation Research Report

Date: March 26, 2026
Workspace reviewed: `/Users/adityakumar/Downloads/cusp`

## Executive Summary

CUSP is no longer just a mock frontend. The current worktree shows a meaningful transition toward a real product:

- Live DFlow market reads are wired into the landing page, Markets page, and Market Detail page.
- Phantom wallet connection is integrated.
- Supabase is being used as the read/write control plane for protocol state, deposits, withdrawals, positions, leveraged trades, and cached markets.
- Solana transaction flows exist for deposit, direct trading, leveraged trading, and some backend settlement paths.

That said, the project is not production-ready and should not be treated as fund-safe in its current form.

The repo is in a hybrid state:

- Strongest area: market discovery and market-detail trading UX.
- Mid-state area: vault and portfolio read models.
- Weakest area: protocol security, accounting integrity, liquidation/close lifecycle, and the public `Lend` route.

The biggest conclusion is simple:

> The frontend has crossed into "real integration" territory faster than the backend trust, accounting, and operational controls have matured.

## Scope Of This Review

This report is based on:

- Existing docs in `docs/`
- Current frontend code in `src/`
- Current Supabase schema and edge functions in `supabase/`
- Local validation runs:
  - `npm test`
  - `npm run build`
  - `npm run lint`
- Git state and recent commit history

This report does not claim live production verification of Supabase secrets, deployed edge functions, or actual mainnet balances. It is a codebase-state assessment.

## Repo Snapshot

## 1. Branch / worktree situation

Current `main` contains committed DFlow and Phantom integration work, but the worktree also has substantial uncommitted additions, especially around:

- Supabase schema and edge functions
- Vault and portfolio integration
- Protocol hooks
- Solana helpers

Implication:

- The current repo state is materially ahead of the latest commit history.
- Existing planning docs are now partly stale because the codebase has moved beyond the "100% mock" phase.

## 2. Product surfaces in the repo

Main app routes:

- `/`
- `/vault`
- `/lend`
- `/markets`
- `/markets/:ticker`
- `/portfolio`
- `/auth/callback`

Secondary app:

- `coming-soon/` contains a separate Vite app for a waitlist-first deployment mode.

## 3. Core stack

- Vite + React + TypeScript
- React Query
- Tailwind + shadcn/ui
- Phantom React SDK
- Solana Web3 + SPL Token
- Supabase JS client
- Supabase Edge Functions
- DFlow Metadata API, Trade API, and WebSocket streams

## What Is Actually Live Today

The project has four different "levels of reality": live, partially live, wired but unsafe, and still mocked.

## 1. Live read paths

### Markets

The following are genuinely wired to DFlow data:

- Landing page top markets and market stats
- Markets explorer list
- Market detail market metadata
- Market detail candlestick history
- Market detail orderbook
- Market detail live prices and trades via WebSocket

Evidence:

- `src/lib/dflow-api.ts`
- `src/hooks/useDflowMarkets.ts`
- `src/hooks/useDflowWebSocket.ts`
- `src/pages/Index.tsx`
- `src/pages/Markets.tsx`
- `src/pages/MarketDetail.tsx`

Assessment:

- This is the most mature part of the product.
- If someone asked "what part feels closest to a real app?", this is it.

## 2. Live wallet connectivity

Wallet connection is no longer mocked. The app uses Phantom Connect:

- provider setup
- modal open/connect
- auth callback route
- wallet balances displayed in navbar

Evidence:

- `src/lib/phantom.tsx`
- `src/pages/AuthCallback.tsx`
- `src/components/Navbar.tsx`

Assessment:

- This is a real integration, not placeholder UX.
- There is still config drift: the Phantom app id is hardcoded in code even though env types declare `VITE_PHANTOM_APP_ID`.

## 3. Live protocol read models, if Supabase is configured

The app now assumes a Supabase-backed protocol state:

- protocol singleton state
- user portfolio
- exchange-rate history
- outcome token holdings mapped from Solana RPC + cached markets

Evidence:

- `src/hooks/useProtocolState.ts`
- `src/hooks/useUserPortfolio.ts`
- `src/hooks/useExchangeRateHistory.ts`
- `src/hooks/useOutcomeTokenHoldings.ts`

Assessment:

- This is a meaningful step toward a real dashboard.
- The frontend is no longer architected as a pure mock app.
- It still depends heavily on Supabase schema/functions being deployed correctly.

## 4. Real write-flow intent exists

The codebase contains real transaction intent for:

- deposit USDC
- withdraw against cUSDC
- direct buy of YES/NO via DFlow quote transaction
- leveraged trade open via margin transfer + backend execution
- close position
- liquidate
- sync markets cache
- update yield

Evidence:

- `src/hooks/useDeposit.ts`
- `src/hooks/useWithdraw.ts`
- `src/hooks/useLeveragedTrade.ts`
- `supabase/functions/deposit/index.ts`
- `supabase/functions/withdraw/index.ts`
- `supabase/functions/open-position/index.ts`
- `supabase/functions/close-position/index.ts`
- `supabase/functions/liquidate/index.ts`
- `supabase/functions/update-yield/index.ts`

Assessment:

- This is no longer a design-only repo.
- But several of these flows are not yet trustworthy enough for production use.

## What Is Still Mocked Or Incoherent

## 1. The public `Lend` route is still mock UI

This is one of the clearest product mismatches in the repo.

`/lend` still renders mock loans and a mock borrow panel:

- `src/pages/Lend.tsx`
- `src/components/BorrowPanel.tsx`
- `src/data/mockData.ts`

At the same time, leveraged trading logic exists elsewhere:

- `src/pages/MarketDetail.tsx`
- `src/hooks/useLeveragedTrade.ts`
- `supabase/functions/risk-check/index.ts`
- `supabase/functions/open-position/index.ts`

Conclusion:

- The actual leverage flow lives on market detail.
- The dedicated Lend page still reflects the older concept stage.
- Product architecture and route architecture are out of sync.

## 2. Landing page remains partially theatrical

The landing page mixes real and simulated content:

- Top markets are live
- Waitlist is real only if Supabase waitlist schema has been manually applied
- FAQ and yield-source narrative are static
- APY presentation is based on protocol state and marketing assumptions, not an audited yield engine

Conclusion:

- The landing page looks production-like, but it is still partly a sales surface over an unfinished backend.

## 3. Database contract is only partly source-controlled

The waitlist schema exists in docs:

- `docs/supabase-waitlist-schema.sql`

But it is not represented in the numbered migrations under `supabase/migrations/`.

There is also frontend usage of an RPC that does not exist anywhere in the repo:

- `record_direct_trade` is called from `src/pages/MarketDetail.tsx`
- no matching SQL definition was found in the repository

Conclusion:

- The source of truth for backend schema is fragmented.
- A clean environment bootstrap is not yet guaranteed from repo contents alone.

## Current Architecture

See diagrams:

- `docs/diagrams/cusp-current-system-map.excalidraw`
- `docs/diagrams/cusp-readiness-gaps.excalidraw`

In words, the current architecture is:

1. Browser app reads market data directly from DFlow.
2. Browser app reads protocol/user state from Supabase.
3. Browser app uses Phantom for user-signed wallet actions.
4. Supabase edge functions use service-role DB access and a vault keypair to execute protocol-managed actions.
5. Solana mainnet acts as the settlement layer for user transfers, cUSDC minting, and DFlow-routed transactions.

This is a reasonable MVP shape, but only if the trust and accounting model are tightened considerably.

## Highest-Risk Findings

The items below are ordered by severity, not by implementation order.

## 1. Edge functions trust caller-provided wallet addresses

Multiple critical write paths accept `wallet_address` from the request body and then act on behalf of that wallet without a verified authentication proof tied to the request.

Affected examples:

- `supabase/functions/deposit/index.ts`
- `supabase/functions/withdraw/index.ts`
- `supabase/functions/open-position/index.ts`
- `supabase/functions/close-position/index.ts`

Why this matters:

- The server is using service-role DB access and, in some cases, a vault keypair.
- Without a strong auth model, the function boundary becomes the weakest link in the system.

Related amplifier:

- CORS is effectively open:
  - `supabase/functions/_shared/cors.ts`

Bottom line:

- These flows should be treated as unsafe until request authentication and ownership checks are enforced.

## 2. Withdraw path does not burn or verify the user's cUSDC before sending USDC

The withdraw function computes `usdcAmount`, decides instant vs queued, and for instant withdrawals transfers USDC from the vault to the provided wallet.

But the function does not actually:

- verify the user owns the claimed cUSDC amount
- burn the user's cUSDC
- prove the caller authorized the redemption

Evidence:

- `supabase/functions/withdraw/index.ts`
- note that `createBurnInstruction` is imported but never used

Why this matters:

- This is a core accounting break.
- If deployed as-is with real assets, redemption integrity is not enforceable.

## 3. Deposit flow appears replayable / misattributable

Deposit verifies that a provided transaction signature transferred the expected USDC amount to the vault, then mints cUSDC to the supplied `wallet_address`.

The current code does not clearly enforce:

- that the sender of the verified transfer matches the claimed `wallet_address`
- that a transaction signature can only be consumed once

Evidence:

- `supabase/functions/deposit/index.ts`
- schema does not show a uniqueness guard on `deposits.tx_signature`

Why this matters:

- A valid deposit transaction could potentially be replayed or attributed incorrectly if the function is called maliciously.

## 4. Protocol accounting is not closed over the full lifecycle

`open-position` updates protocol state:

- increases `deployed_usdc`
- decreases `reserve_usdc`

But `close-position` and `liquidate` do not symmetrically restore protocol state.

Evidence:

- `supabase/functions/open-position/index.ts`
- `supabase/functions/close-position/index.ts`
- `supabase/functions/liquidate/index.ts`

Why this matters:

- Protocol state will drift from reality.
- Reserve ratio, deployed ratio, TVL, and vault health become unreliable.

## 5. Leveraged trade risk fields are mostly static

`leveraged_trades` are inserted with:

- `health_factor: 2.0`
- `borrow_rate_bps: 500`

I did not find any recurring job or function that continuously:

- recalculates health factor from live prices
- accrues interest over time
- updates `accrued_interest`

Evidence:

- `supabase/functions/open-position/index.ts`
- `supabase/functions/liquidate/index.ts`
- repo search found reads of health factor, but no real recalculation loop

Why this matters:

- The risk engine currently blocks some openings, but it does not appear to maintain truthful ongoing risk state.

## 6. Close path lacks visible user-ownership enforcement

`close-position` accepts both `position_id` and `wallet_address`, but the wallet value is not used to enforce position ownership before the server performs the close flow.

Evidence:

- `supabase/functions/close-position/index.ts`

Why this matters:

- A position-management endpoint should not depend on goodwill from the caller.

## 7. Source-controlled backend is incomplete

Examples:

- waitlist schema lives in docs, not migrations
- `record_direct_trade` is referenced by the frontend but absent from repo SQL
- generated DB types do not fully match current frontend assumptions

Evidence:

- `docs/supabase-waitlist-schema.sql`
- `src/pages/MarketDetail.tsx`
- `src/lib/database.types.ts`

Why this matters:

- A fresh deploy from repo contents alone may not match the frontend contract.

## Quality And Delivery Signals

## 1. Build status

Validated locally on March 26, 2026:

- `npm run build` -> passes

Notable output:

- production JS bundle: `2,415.70 kB` raw
- gzip main bundle: `709.43 kB`
- Vite warns about oversized chunks

Interpretation:

- The app builds, but bundle size is already a real delivery concern.

## 2. Test status

Validated locally:

- `npm test` -> passes

But only one placeholder test exists:

- `src/test/example.test.ts`

Interpretation:

- "Tests pass" currently has almost no meaning.

## 3. Lint status

Validated locally:

- `npm run lint` -> fails

Observed:

- 5 errors
- 13 warnings

Important failure areas include:

- forbidden `require()` usage
- explicit `any`
- empty object type interfaces
- hook dependency issues

Interpretation:

- The repo is building in spite of maintainability and correctness debt.

## 4. Type/schema drift

Examples:

- `useUserPortfolio` expects `total_withdrawn`, but the SQL function shown in migrations does not return it
- env types declare DFlow and Phantom config variables, but runtime code still hardcodes some of them

Interpretation:

- The codebase is moving quickly, but contracts are not yet consistently reconciled.

## Readiness Assessment

## Product UX

Status: Partial

- Markets UX is strong
- Vault and portfolio are plausible
- Lend is still concept-stage in its dedicated route

## Data Integration

Status: Mixed but improving

- DFlow read-path is real
- Supabase read-path is real if configured
- direct-trade persistence contract is incomplete in source control

## Wallet / Transactions

Status: Partial

- wallet connect is real
- user-signed direct trade flow exists
- deposit and leveraged flows are present
- trust model and redemption integrity are not ready

## Protocol Accounting

Status: Not yet trustworthy

- deposit accounting exists
- withdrawal accounting is incomplete
- open/close/liquidate state transitions are not balanced

## Risk Engine

Status: Early prototype

- open-time checks exist
- continuous health maintenance appears absent
- liquidation is mostly a status mutation plus fee insertion

## Security

Status: High concern

- unauthenticated or under-authenticated critical write paths
- open CORS
- server-side privileged actions

## Ops / CI / Release

Status: Minimal

- build works
- no meaningful test safety net
- no evidence of CI gates in repo

## Recommended Next Sequence

If the goal is to turn this into a safe alpha rather than a compelling demo, the next order should be:

1. Lock down the trust boundary.
   - Require authenticated wallet ownership for every privileged edge-function write.
   - Remove trust in raw `wallet_address` request fields.

2. Fix redemption and deposit integrity.
   - Withdrawal must verify/burn cUSDC before payout.
   - Deposit must enforce sender matching, uniqueness, and replay protection.

3. Close the protocol accounting loop.
   - Balance `protocol_state` across open, close, settle, liquidate, and withdraw.
   - Decide what TVL/reserve/deployed mean and update them consistently.

4. Unify product surface.
   - Decide whether leveraged trading lives on Market Detail, on Lend, or both.
   - Remove the current split-brain product story.

5. Bring backend contract fully into source control.
   - Promote waitlist SQL into migrations.
   - Add missing SQL/RPC for direct trade recording or remove the call.
   - Regenerate typed DB contracts from the actual schema.

6. Add real verification.
   - unit tests for accounting/risk math
   - integration tests for edge functions
   - end-to-end tests for deposit, withdraw, and trade flows

7. Reduce frontend delivery risk.
   - split the large bundle
   - fix lint failures

## Bottom-Line Assessment

Today, CUSP is best described as:

> A serious product prototype with real market data, real wallet connectivity, and the beginnings of a real protocol backend, but not yet a secure or internally consistent capital system.

If you demo it:

- emphasize markets, detail pages, and portfolio direction
- avoid overstating backend readiness

If you want to move toward private alpha:

- security and accounting must become the immediate priority, ahead of new UX surface area

## Files Most Worth Reading Next

- `src/pages/MarketDetail.tsx`
- `src/pages/Vault.tsx`
- `src/pages/Portfolio.tsx`
- `src/hooks/useDeposit.ts`
- `src/hooks/useWithdraw.ts`
- `src/hooks/useLeveragedTrade.ts`
- `supabase/functions/deposit/index.ts`
- `supabase/functions/withdraw/index.ts`
- `supabase/functions/open-position/index.ts`
- `supabase/functions/close-position/index.ts`
- `supabase/functions/liquidate/index.ts`
- `supabase/migrations/001_protocol_schema.sql`

