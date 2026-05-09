export interface Market {
  id: string;
  name: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  probability: number;
  volume: number;
  resolutionDate: string;
  vaultExposure: boolean;
  estimatedYield: number;
}

export interface VaultPosition {
  id: string;
  marketName: string;
  tokenType: "YES" | "NO";
  entryPrice: number;
  currentPrice: number;
  probability: number;
  daysToResolution: number;
  unrealizedPnL: number;
  quantity: number;
}

export interface ActiveLoan {
  id: string;
  marketName: string;
  tokenType: "YES" | "NO";
  collateralValue: number;
  borrowedAmount: number;
  healthFactor: number;
  resolutionDate: string;
  ltv: number;
}

export const mockMarkets: Market[] = [
  { id: "1", name: "BTC above $150K by March 2026", category: "Crypto", yesPrice: 0.87, noPrice: 0.13, probability: 87, volume: 2450000, resolutionDate: "2026-03-31T00:00:00Z", vaultExposure: true, estimatedYield: 18.4 },
  { id: "2", name: "Fed cuts rates in Q1 2026", category: "Economics", yesPrice: 0.72, noPrice: 0.28, probability: 72, volume: 1830000, resolutionDate: "2026-03-28T00:00:00Z", vaultExposure: true, estimatedYield: 22.1 },
  { id: "3", name: "ETH flips BNB in daily volume", category: "Crypto", yesPrice: 0.91, noPrice: 0.09, probability: 91, volume: 980000, resolutionDate: "2026-03-15T00:00:00Z", vaultExposure: true, estimatedYield: 15.8 },
  { id: "4", name: "S&P 500 closes above 6000", category: "Finance", yesPrice: 0.64, noPrice: 0.36, probability: 64, volume: 3200000, resolutionDate: "2026-04-30T00:00:00Z", vaultExposure: false, estimatedYield: 24.2 },
  { id: "5", name: "Lakers make NBA playoffs", category: "Sports", yesPrice: 0.56, noPrice: 0.44, probability: 56, volume: 890000, resolutionDate: "2026-04-15T00:00:00Z", vaultExposure: false, estimatedYield: 19.7 },
  { id: "6", name: "US GDP growth above 2.5%", category: "Economics", yesPrice: 0.78, noPrice: 0.22, probability: 78, volume: 1450000, resolutionDate: "2026-06-30T00:00:00Z", vaultExposure: false, estimatedYield: 20.3 },
  { id: "7", name: "SOL above $300 by April", category: "Crypto", yesPrice: 0.42, noPrice: 0.58, probability: 42, volume: 2100000, resolutionDate: "2026-04-01T00:00:00Z", vaultExposure: false, estimatedYield: 28.1 },
  { id: "8", name: "EU passes stablecoin regulation", category: "Politics", yesPrice: 0.89, noPrice: 0.11, probability: 89, volume: 670000, resolutionDate: "2026-05-01T00:00:00Z", vaultExposure: true, estimatedYield: 16.2 },
];

export const mockVaultPositions: VaultPosition[] = [
  { id: "1", marketName: "BTC above $150K by March 2026", tokenType: "YES", entryPrice: 0.82, currentPrice: 0.87, probability: 87, daysToResolution: 24, unrealizedPnL: 1240, quantity: 25000 },
  { id: "2", marketName: "Fed cuts rates in Q1 2026", tokenType: "YES", entryPrice: 0.68, currentPrice: 0.72, probability: 72, daysToResolution: 21, unrealizedPnL: 890, quantity: 22000 },
  { id: "3", marketName: "ETH flips BNB in daily volume", tokenType: "YES", entryPrice: 0.88, currentPrice: 0.91, probability: 91, daysToResolution: 8, unrealizedPnL: 650, quantity: 21500 },
  { id: "4", marketName: "EU passes stablecoin regulation", tokenType: "YES", entryPrice: 0.85, currentPrice: 0.89, probability: 89, daysToResolution: 55, unrealizedPnL: 430, quantity: 10800 },
];

export const mockActiveLoans: ActiveLoan[] = [
  { id: "1", marketName: "BTC above $150K by March 2026", tokenType: "YES", collateralValue: 8700, borrowedAmount: 6500, healthFactor: 1.34, resolutionDate: "2026-03-31T00:00:00Z", ltv: 75 },
  { id: "2", marketName: "ETH flips BNB in daily volume", tokenType: "YES", collateralValue: 4550, borrowedAmount: 3500, healthFactor: 1.08, resolutionDate: "2026-03-15T00:00:00Z", ltv: 77 },
];

export const mockVaultStats = {
  totalTVL: 12_450_000,
  currentAPY: 19.4,
  activePositions: 24,
  nextResolution: "2026-03-15T00:00:00Z",
  totalDeposited: 50000,
  vsUSDCBalance: 48750,
  earnedYield: 1892.34,
  avgAPY30d: 18.7,
};

export const mockPortfolio = {
  totalDeposited: 50000,
  totalBorrowed: 10000,
  netYieldEarned: 1892.34,
  openPositionsValue: 38750,
};

export const mockVaultNAVHistory = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(Date.now() - (90 - i) * 86400000).toISOString().split("T")[0],
  nav: 1 + (i * 0.002) + Math.sin(i * 0.1) * 0.005,
}));

export const mockStatsBar = {
  capitalDeployed: 12_450_000,
  outcomesResolved: 1847,
  avgAPY30d: 18.7,
  activeLPWallets: 3420,
};

export const faqItems = [
  { q: "What is Cusp?", a: "Cusp is the DeFi layer for prediction markets on Solana. Our first product is a protocol for borrowing against, lending to, and leveraging Kalshi positions. Over time we will expand to more markets and financial primitives across the prediction-market stack." },
  { q: "How does it work?", a: "On Kalshi, every share you buy is a claim that settles to $1 if you are right. DFlow tokenizes those YES/NO outcomes as SPL tokens on Solana. Cusp lets you transfer and deposit these tokens into our pools to borrow USDT against them, or deposit USDT directly to earn yield from those same borrowers." },
  { q: "How secure is it?", a: "Cusp is non-custodial. Your collateral and deposits live in audited on-chain programs on Solana — nobody, including our team, can withdraw your assets outside of the protocol rules. All loans carry hard expiry: positions automatically close two hours before a market resolves, which protects lenders from binary settlement risk." },
  { q: "Is Kalshi regulated?", a: "Yes. Kalshi is a CFTC-regulated exchange — the first federally regulated prediction market in the United States. That gives the markets Cusp builds on top of real regulatory clarity, unlike most crypto-native prediction platforms." },
  { q: "Who uses it?", a: "Traders use Cusp to maximize capital efficiency on their Kalshi positions — borrowing USDT without selling, looping into 2x leverage, or earning passive yield by lending into the same pools. Advanced users and funds use it as a financial primitive on top of regulated event markets." },
  { q: "Does it have any fees?", a: "During beta, protocol fees are effectively zero. A small interest spread and performance fee will be introduced later; whenever that changes it will be documented transparently in the docs." },
  { q: "Is there a token?", a: "No. Cusp has no token today and no plans to issue one in the foreseeable future. The protocol is designed to earn from real yield — borrower interest and lending spread — not emissions." },
];
