# Cusp: Current State and End-to-End Completion Plan

## 1) What We Have Right Now

### Product Shape (Frontend)
- A React + TypeScript + Vite web app with routed pages:
  - `/` Landing
  - `/vault`
  - `/lend`
  - `/markets`
  - `/portfolio`
- UI is high-fidelity and mostly consistent with a defined design system (Tailwind + shadcn primitives + custom token/theme colors).
- Key user-facing concepts are clearly represented in the interface:
  - USDC vault deposits and yield display
  - Borrowing against YES/NO prediction-market positions
  - Market exploration and filtering
  - Portfolio overview tabs

### Interaction State
- Core interactions are simulated only (no real protocol/API integration):
  - Wallet connect is a mock modal with timeout-based fake connection.
  - Deposit/withdraw and borrow panels do local calculations only.
  - Market, vault, loan, and portfolio values come from static mock data.

### Codebase/Engineering State
- Single package app (no backend/indexer/contract code in this repo).
- Basic tooling is configured (ESLint, Vitest, Vite).
- Test coverage is essentially placeholder-level (example test only).
- README is scaffold boilerplate and not product-specific.

### Operational State
- No defined environments/configs for dev/stage/prod protocol integrations.
- No observability, error reporting, feature flags, or analytics instrumentation.
- No formal security/risk controls implemented in code (only described in copy/UI).

## 2) What “End-to-End Complete” Should Mean

An end-to-end complete Cusp MVP should allow a user to:
1. Connect a supported Solana wallet.
2. View live markets and tokenized YES/NO positions from real data sources.
3. Deposit USDC into a real vault strategy and receive a vault share token representation.
4. Borrow USDC against eligible collateral positions with enforceable LTV/health logic.
5. Repay/close loans and request/complete withdrawals.
6. See accurate portfolio, history, and risk status from on-chain + indexed data.

And should allow operators to:
1. Configure strategy/risk parameters safely.
2. Monitor protocol health, incidents, and user-impacting failures.
3. Roll out changes across environments with repeatable CI/CD and rollback paths.

## 3) Gaps to Close (Current -> Complete)

### A) Protocol and Data Layer
- Define canonical architecture:
  - On-chain programs and accounts (vault, lending, collateral, liquidation rules).
  - Off-chain indexer/services for derived state (APY, health, NAV history, positions).
- Define source-of-truth boundaries:
  - What is read directly from chain vs computed server-side.
- Implement APIs/SDK contract for frontend consumption.

### B) Wallet and Transaction Flows
- Integrate real Solana wallet adapters and connection state.
- Implement signed transaction flows for:
  - Deposit
  - Withdraw request + claim
  - Borrow
  - Repay
  - Collateral management
- Implement robust transaction UX:
  - Pending/confirmed/failed states
  - Retry and error handling
  - Explorer links and signatures

### C) Risk Engine and Protocol Safety
- Enforce LTV and health factor with deterministic formulas.
- Handle time-to-resolution and hard-expiry rules for binary markets.
- Liquidation logic and keeper/automation path.
- Price/probability oracle/data freshness checks and circuit breakers.

### D) Frontend Product Completion
- Replace all mock data with real query hooks/services.
- Add authenticated/connected user state and empty/loading/error states everywhere.
- Improve accessibility and responsive behavior under real data volatility.
- Add account/transaction history and status timelines.

### E) QA, Security, and Reliability
- Add real test strategy:
  - Unit tests for risk math and formatting
  - Integration tests for API hooks and transaction actions
  - E2E tests for critical user journeys
- Security workstream:
  - Threat model
  - Smart contract audit process
  - Frontend dependency and supply-chain checks
- Add monitoring/alerting:
  - Client error tracking
  - API latency/error SLOs
  - On-chain event anomaly alerts

### F) DevEx and Operations
- Document architecture + runbooks + incident processes.
- Configure CI/CD with gates (lint/test/build/type-check/security checks).
- Define environment configs and secrets management.
- Publish a production-ready README and contributor docs.

## 4) Proposed Delivery Phases

## Phase 0: Foundations (1-2 weeks)
- Finalize architecture decision record (frontend/API/indexer/chain boundaries).
- Define product requirements for Vault and Lend MVP scope.
- Write technical specs for transaction flows and risk formulas.
- Establish environments and baseline CI.

Exit criteria:
- Approved architecture + API contracts + risk formula spec.

## Phase 1: Data + Wallet Integration (2-3 weeks)
- Integrate wallet adapter and session state.
- Implement read-path data integration (markets, positions, portfolio snapshots).
- Remove mock data from primary views.

Exit criteria:
- Connected users can view live, account-specific data end-to-end (read-only).

## Phase 2: Write Flows MVP (3-5 weeks)
- Implement deposit/withdraw and borrow/repay signed transactions.
- Add transaction status tracking and failure recovery UX.
- Add initial guardrails (input validation, stale data checks, limits).

Exit criteria:
- Users can execute core write actions successfully on target network.

## Phase 3: Risk + Liquidation + Hardening (3-4 weeks)
- Implement and validate liquidation and expiry handling.
- Add operator controls and risk parameter management path.
- Add comprehensive tests, monitoring, and alerting.

Exit criteria:
- Risk controls are enforced and observable; incidents are detectable/recoverable.

## Phase 4: Launch Readiness (1-2 weeks)
- Performance tuning, a11y pass, final UX polish.
- Security review/audit closure.
- Production docs, runbooks, and go-live checklist.

Exit criteria:
- Signed launch checklist and operational readiness.

## 5) MVP Feature Checklist (Definition of Done)

### User Features
- [ ] Connect/disconnect wallet
- [ ] Live markets explorer
- [ ] Live vault stats and NAV chart
- [ ] Deposit USDC
- [ ] Request and claim withdrawals
- [ ] Borrow against eligible collateral
- [ ] Repay and unlock collateral
- [ ] Portfolio with live balances, loans, health, and tx history

### System Features
- [ ] On-chain instruction coverage for all core actions
- [ ] Indexer/API providing normalized read models
- [ ] Deterministic risk computation + liquidation handling
- [ ] Full state/error observability
- [ ] CI/CD with required checks

### Quality/Security
- [ ] Unit/integration/E2E test baseline
- [ ] Smart contract audit findings resolved or accepted with mitigation
- [ ] Runbooks and incident response docs completed

## 6) Immediate Next Steps (Suggested)
1. Replace README boilerplate with a product-specific README and architecture overview.
2. Decide and document the exact MVP boundary (Vault-only first vs Vault + Lend together).
3. Implement wallet + read-only live data integration first, then write transactions.
4. Lock risk formulas and liquidation policy before production write flows.

## 7) Risks to Track Early
- Data mismatch between chain state and indexed API state.
- Incorrect LTV/health calculations under edge market conditions.
- Transaction UX failures causing user confusion/fund-risk perceptions.
- Regulatory/compliance constraints depending on target jurisdictions and integrations.

---
Owner note: this document is a planning baseline; update it at each milestone with dates, owners, and completion evidence.
