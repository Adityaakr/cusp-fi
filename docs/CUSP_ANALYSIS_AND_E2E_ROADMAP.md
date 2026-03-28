# CUSP: Current State Analysis and End-to-End Completion Roadmap

## Core Thesis

> Your prediction market positions should not sit idle.

We are not building a prediction market exchange. We are building a **yield-first financial product** on top of prediction market infrastructure.

---

## 1. What We Have Right Now

### 1.1 Product Shape (Frontend)

| Area | Status | Details |
|------|--------|---------|
| **Frontend** | High-fidelity mock | React + Vite + shadcn, 5 pages (Index, Vault, Lend, Markets, Portfolio) |
| **Design System** | Complete | Dark theme, teal accent (171 100% 45%), DM Sans + Geist Mono, `--bg-0` through `--bg-3`, `glow-teal`, `border-active` |
| **Data** | 100% mock | All from `src/data/mockData.ts` |
| **Wallet** | Mock only | `WalletConnectModal` simulates connection with timeout |
| **Backend/API** | None | No DFlow, Kamino, Privy, or Supabase integration |
| **Deployment** | None | No `vercel.json`, no env config |
| **Waitlist** | None | No coming-soon or early-access flow |

**Design tokens to preserve for V1:** `--cusp-teal`, `--bg-0` to `--bg-3`, `--cusp-amber`, `--cusp-green`, `--cusp-red`, `--radius: 6px`, `.glow-teal`, `.font-mono-data`

### 1.2 Pages and Components

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Index | Landing: hero, vault preview, how it works, APY breakdown, FAQ, CTA |
| `/vault` | Vault | USDC vault: stats, NAV chart, deposit/withdraw, positions |
| `/lend` | Lend | Borrow against YES/NO tokens: active loans, borrow panel |
| `/markets` | Markets | Markets explorer: search, filters, market cards |
| `/portfolio` | Portfolio | Tabs: Vault Positions, Active Loans, Resolved Markets, Transactions |
| `*` | NotFound | 404 page |

### 1.3 Interaction State

- Core interactions are simulated only (no real protocol/API integration)
- Wallet connect is a mock modal with timeout-based fake connection
- Deposit/withdraw and borrow panels do local calculations only
- Market, vault, loan, and portfolio values come from static mock data

### 1.4 Codebase/Engineering State

- Single package app (no backend/indexer/contract code in this repo)
- Basic tooling: ESLint, Vitest, Vite
- Test coverage is placeholder-level (example test only)
- README is scaffold boilerplate, not product-specific

### 1.5 Operational State

- No defined environments/configs for dev/stage/prod protocol integrations
- No observability, error reporting, feature flags, or analytics instrumentation
- No formal security/risk controls implemented in code (only described in copy/UI)

---

## 2. V1 Product Scope (from Thesis) vs Current UI

### V1 Scope — Private Alpha / Invite-Only

**V1 users can do 2 main things:**

1. **Deposit USDC into the CUSP vault**
   - Users deposit USDC → receive vault shares
   - Vault allocates deployable USDC into high-probability prediction market positions through DFlow
   - Idle reserve capital parked in base-yield venue (e.g. Kamino)
   - Users see: vault NAV, share value, reserve ratio, yield source breakdown
   - Withdrawal: instant reserve or queue-based flow

2. **Enroll existing YES/NO SPL outcome tokens**
   - Users who hold YES/NO outcome tokens can deposit/enroll them without closing the position
   - Enrolled positions remain tracked separately (not same as USDC vault shares)
   - Earn productive yield while maintaining prediction market exposure
   - Exit with same token position or post-resolution payout plus accrued yield

### Gap: Current UI vs V1 Scope

| V1 Requirement | Current UI | Gap |
|----------------|------------|-----|
| USDC deposit | Vault page — deposit/withdraw | Mock only; needs real Solana tx + vault program |
| YES/NO enrollment | Lend page is **borrow** (Phase 2) | V1 needs **enrollment** flow — different UX |
| Vault overview | Stats exist (mock) | TVL, NAV, APY, reserve ratio, deployed ratio |
| Portfolio | Tabs exist (mock) | Live positions, enrolled, history |
| Withdrawal | Mock in Vault | Instant reserve + queue flow |
| Risk center | Copy only | Reserve policy, caps, disclosures |

**Critical:** Current "Lend" page implements borrow-against-collateral (Phase 2). V1 needs **YES/NO enrollment** — deposit tokens, earn yield, keep exposure. The Lend page would need to be repurposed or a new "Enroll" flow added.

---

## 3. What We Need for 100% Live V1

| Layer | Required | Current |
|-------|----------|---------|
| **Marketing / Landing** | Coming soon + waitlist | Full landing exists; need coming-soon variant |
| **Auth** | Privy or wallet-only | None |
| **USDC Deposit** | Real Solana tx + vault program | Mock only |
| **YES/NO Enrollment** | Real enrollment flow | Lend page is borrow, not enroll |
| **Vault Overview** | TVL, NAV, APY, reserve ratio, deployed ratio | Stats exist (mock) |
| **Portfolio** | Live positions, enrolled, history | Mock |
| **Withdrawal** | Instant reserve + queue flow | Mock |
| **Risk Center** | Reserve policy, caps, disclosures | Copy only |
| **Activity/History** | Real tx history | Mock |
| **DFlow Integration** | Markets + SPL tokens | None |
| **Kamino** | Idle reserve yield | Not referenced |
| **Invite-only** | Access control | None |

### V1 Must Include (Checklist)

- [ ] Marketing / landing page
- [ ] Waitlist / early access
- [ ] Logged-in dashboard
- [ ] USDC deposit flow
- [ ] YES/NO position enrollment flow
- [ ] Vault overview (TVL, NAV, APY, reserve ratio, deployed ratio)
- [ ] Portfolio page
- [ ] Withdrawal / queue flow
- [ ] Risk and transparency center
- [ ] Activity/history page
- [ ] System health / trust indicators
- [ ] Invite-only / coming soon framing

### V1 Trust Principles

- Real-time or near-real-time NAV visibility
- Clear reserve policy
- Clear exposure caps
- Visible risk disclosures
- No overhyped promises
- No "risk-free" language
- Strong transparency UX
- Calm premium copy

### V1 Risk Model

- Conservative alpha
- Tight exposure caps
- Minimum reserve held at all times
- New positions only in eligible high-probability markets
- Circuit breakers for stale data, drawdowns, outages, or execution failures
- Queue withdrawals if liquidity is constrained

### V1 Exclusions

- No lending/borrowing live yet (Phase 2)
- No cross-chain expansion yet
- No public mass-market launch yet
- No overcomplicated governance/token mechanics
- No exchange/orderbook UI
- No bridge-heavy UX

---

## 4. Phase 2 and Phase 3 (Coming Soon)

### Phase 2

**Borrow against YES/NO positions without closing them.**

- Present as real upcoming feature, not vague filler
- Show future borrowing UX, indicative LTV concepts
- Early-access / notify-me surfaces

### Phase 3

**Unified cross-market capital layer.**

- Portfolio visibility and position intelligence beyond initial DFlow scope
- Future Polymarket/API-based expansion
- Emphasize unified visibility and capital efficiency — not bridging

---

## 5. Gaps to Close (Current → Complete)

### A) Protocol and Data Layer

- Define canonical architecture: on-chain programs, off-chain indexer/services
- Define source-of-truth boundaries (chain vs server-side)
- Implement APIs/SDK contract for frontend consumption
- DFlow integration for markets and SPL tokens
- Kamino (or equivalent) for idle reserve yield

### B) Wallet and Transaction Flows

- Integrate real Solana wallet adapters and connection state
- Implement signed transaction flows: deposit, withdraw, enroll, exit
- Robust transaction UX: pending/confirmed/failed, retry, explorer links

### C) Risk Engine and Protocol Safety

- Enforce LTV and health factor (Phase 2)
- Time-to-resolution and hard-expiry rules for binary markets
- Price/probability oracle/data freshness checks and circuit breakers

### D) Frontend Product Completion

- Replace all mock data with real query hooks/services
- Add authenticated/connected user state and empty/loading/error states
- Add YES/NO enrollment flow (distinct from borrow)
- Add account/transaction history and status timelines

### E) QA, Security, and Reliability

- Unit tests for risk math and formatting
- Integration tests for API hooks and transaction actions
- E2E tests for critical user journeys
- Security workstream: threat model, audit process

### F) DevEx and Operations

- Document architecture + runbooks + incident processes
- Configure CI/CD with gates
- Define environment configs and secrets management

---

## 6. Proposed Delivery Phases

### Phase 0: Foundations (1–2 weeks)

- Finalize architecture decision record
- Define product requirements for Vault and Enroll MVP scope
- Write technical specs for transaction flows and risk formulas
- Establish environments and baseline CI

### Phase 1: Data + Wallet Integration (2–3 weeks)

- Integrate wallet adapter and session state
- Implement read-path data integration (markets, positions, portfolio)
- Remove mock data from primary views

### Phase 2: Write Flows MVP (3–5 weeks)

- Implement deposit/withdraw and enroll/exit signed transactions
- Add transaction status tracking and failure recovery UX
- Add initial guardrails (input validation, stale data checks, limits)

### Phase 3: Risk + Hardening (3–4 weeks)

- Implement and validate expiry handling
- Add operator controls and risk parameter management path
- Add comprehensive tests, monitoring, and alerting

### Phase 4: Launch Readiness (1–2 weeks)

- Performance tuning, a11y pass, final UX polish
- Security review/audit closure
- Production docs, runbooks, and go-live checklist

---

## 7. Design Direction (V1)

- **Theme:** Dark-mode-first, black/carbon/deep charcoal base
- **Accent:** Aqua/teal derived from CUSP branding
- **Style:** Minimal, geometric, sharp, modern
- **Feel:** Premium fintech + crypto infrastructure
- **Effects:** Subtle 3D depth, glass, glow, layered surfaces
- **Tone:** Founder-grade, clear, calm, sharp, trustworthy
- **Avoid:** Cringe crypto buzzwords, exaggerated APY language

---

## 8. Risks to Track Early

- Data mismatch between chain state and indexed API state
- Incorrect LTV/health calculations under edge market conditions
- Transaction UX failures causing user confusion/fund-risk perceptions
- Regulatory/compliance constraints depending on target jurisdictions

---

*Owner note: Update this document at each milestone with dates, owners, and completion evidence.*
