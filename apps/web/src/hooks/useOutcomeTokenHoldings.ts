import { useQuery } from "@tanstack/react-query";
import { usePhantom } from "@/lib/wallet";
import { cuspApiFetch } from "@/lib/cusp-api";
import type { UserPortfolio } from "@/hooks/useUserPortfolio";
import { fetchOutcomeMarketByMint } from "@/lib/dflow-api";
import { getMainnetConnection, MAINNET_USDC, MAINNET_USDT } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export type OutcomeTokenHolding = {
  mint: string;
  ataAddress: string;
  balance: number;
  decimals: number;
  ticker: string | null;
  title: string | null;
  side: "YES" | "NO" | null;
  program: "spl-token" | "token-2022";
  currentPrice: number | null;
  currentValue: number | null;
  probability: number | null;
};

type OutcomeHoldingsApiResponse = {
  success: boolean;
  holdings: Array<{
    mint: string;
    ata_address: string;
    balance: number;
    decimals: number;
    ticker: string | null;
    title: string | null;
    side: "YES" | "NO" | null;
    program: "spl-token" | "token-2022";
    current_price: number | null;
    current_value: number | null;
    probability: number | null;
  }>;
};

type RawWalletHolding = {
  mint: string;
  ataAddress: string;
  balance: number;
  decimals: number;
  program: "spl-token" | "token-2022";
};

function mapApiHolding(
  holding: OutcomeHoldingsApiResponse["holdings"][number]
): OutcomeTokenHolding {
  return {
    mint: holding.mint,
    ataAddress: holding.ata_address,
    balance: Number(holding.balance ?? 0),
    decimals: Number(holding.decimals ?? 0),
    ticker: holding.ticker ?? null,
    title: holding.title ?? null,
    side: holding.side ?? null,
    program: holding.program,
    currentPrice:
      holding.current_price != null ? Number(holding.current_price) : null,
    currentValue:
      holding.current_value != null ? Number(holding.current_value) : null,
    probability:
      holding.probability != null ? Number(holding.probability) : null,
  };
}

function mergePortfolioFallback(
  holdings: OutcomeTokenHolding[],
  portfolio: UserPortfolio | null | undefined
): OutcomeTokenHolding[] {
  const byMint = new Map<string, OutcomeTokenHolding>(
    holdings.map((holding) => [holding.mint, holding])
  );

  for (const position of portfolio?.positions ?? []) {
    if (position.status !== "open" || !position.outcome_mint) continue;
    if (byMint.has(position.outcome_mint)) continue;

    const side = position.side === "YES" || position.side === "NO" ? position.side : null;
    const currentPrice =
      side === "YES"
        ? Number(position.current_yes_price ?? position.entry_price)
        : side === "NO"
          ? Number(position.current_no_price ?? position.entry_price)
          : Number(position.entry_price);
    const normalizedPrice = Number.isFinite(currentPrice) ? currentPrice : null;
    const balance = Number(position.quantity) || 0;

    byMint.set(position.outcome_mint, {
      mint: position.outcome_mint,
      ataAddress: "",
      balance,
      decimals: 0,
      ticker: position.market_ticker,
      title: position.market_title ?? position.market_ticker,
      side,
      program: "token-2022",
      currentPrice: normalizedPrice,
      currentValue:
        normalizedPrice != null && balance > 0 ? normalizedPrice * balance : null,
      probability:
        normalizedPrice != null
          ? Math.round(Math.max(0, Math.min(1, normalizedPrice)) * 100)
          : null,
    });
  }

  return [...byMint.values()].sort((a, b) => {
    const aValue = a.currentValue ?? 0;
    const bValue = b.currentValue ?? 0;
    if (bValue !== aValue) return bValue - aValue;
    return (a.title ?? a.ticker ?? "").localeCompare(b.title ?? b.ticker ?? "");
  });
}

async function enrichWithLiveMarketData(
  holdings: OutcomeTokenHolding[]
): Promise<OutcomeTokenHolding[]> {
  const needsEnrichment = holdings.filter(
    (holding) =>
      holding.currentPrice == null ||
      holding.probability == null ||
      holding.currentValue == null ||
      !holding.side
  );

  if (needsEnrichment.length === 0) return holdings;

  const resolvedByMint = new Map<
    string,
    Awaited<ReturnType<typeof fetchOutcomeMarketByMint>> | null
  >();
  for (const mint of [...new Set(needsEnrichment.map((holding) => holding.mint))]) {
    try {
      resolvedByMint.set(mint, await fetchOutcomeMarketByMint(mint));
    } catch {
      resolvedByMint.set(mint, null);
    }
  }

  return holdings.map((holding) => {
    if (
      holding.side &&
      holding.currentPrice != null &&
      holding.probability != null &&
      holding.currentValue != null
    ) {
      return holding;
    }

    const resolved = resolvedByMint.get(holding.mint);
    if (!resolved) return holding;

    return {
      ...holding,
      ticker: resolved.market.ticker ?? holding.ticker,
      title: resolved.market.name ?? holding.title,
      side: resolved.side,
      currentPrice: resolved.currentPrice,
      probability: resolved.probability,
      currentValue:
        holding.balance > 0 ? holding.balance * resolved.currentPrice : holding.currentValue,
    };
  });
}

async function scanWalletOutcomeHoldingsFromMainnet(
  solanaAddress: string
): Promise<OutcomeTokenHolding[]> {
  const owner = new PublicKey(solanaAddress);
  const connection = getMainnetConnection();
  const excludedMints = new Set<string>([
    MAINNET_USDC.toBase58(),
    MAINNET_USDT.toBase58(),
    "So11111111111111111111111111111111111111112",
  ]);

  const tokenPrograms: Array<{
    key: PublicKey;
    label: "spl-token" | "token-2022";
  }> = [
    { key: TOKEN_PROGRAM_ID, label: "spl-token" },
    { key: TOKEN_2022_PROGRAM_ID, label: "token-2022" },
  ];

  const rawHoldings: RawWalletHolding[] = [];

  await Promise.all(
    tokenPrograms.map(async (program) => {
      try {
        const response = await connection.getParsedTokenAccountsByOwner(
          owner,
          { programId: program.key },
          "confirmed"
        );

        for (const account of response.value) {
          const parsed: any = account.account.data;
          const info = parsed?.parsed?.info;
          const tokenAmount = info?.tokenAmount;
          const mint = typeof info?.mint === "string" ? info.mint : "";
          if (!mint || excludedMints.has(mint)) continue;

          const decimals =
            typeof tokenAmount?.decimals === "number" ? tokenAmount.decimals : 0;
          const uiAmount =
            typeof tokenAmount?.uiAmount === "number"
              ? tokenAmount.uiAmount
              : Number(tokenAmount?.amount ?? 0) / 10 ** decimals;
          const balance = Number.isFinite(uiAmount) ? uiAmount : 0;
          if (balance <= 0) continue;

          rawHoldings.push({
            mint,
            ataAddress: account.pubkey.toBase58(),
            balance,
            decimals,
            program: program.label,
          });
        }
      } catch (error) {
        console.warn(`[outcomeTokens] Frontend wallet scan failed for ${program.label}:`, error);
      }
    })
  );

  const mergedByMint = new Map<string, OutcomeTokenHolding>();
  for (const holding of rawHoldings) {
    const existing = mergedByMint.get(holding.mint);
    if (existing) {
      existing.balance += holding.balance;
      continue;
    }

    mergedByMint.set(holding.mint, {
      mint: holding.mint,
      ataAddress: holding.ataAddress,
      balance: holding.balance,
      decimals: holding.decimals,
      ticker: null,
      title: null,
      side: null,
      program: holding.program,
      currentPrice: null,
      currentValue: null,
      probability: null,
    });
  }

  return enrichWithLiveMarketData([...mergedByMint.values()]);
}

export function useOutcomeTokenHoldings(portfolio: UserPortfolio | null | undefined) {
  const { addresses, isConnected } = usePhantom();
  const solanaAddress =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))
      ?.address ?? null;

  const positionKey = (portfolio?.positions ?? [])
    .filter((position) => position.status === "open" && position.outcome_mint)
    .map((position) => `${position.outcome_mint}:${position.market_ticker}:${position.side}`)
    .sort()
    .join("|");

  return useQuery({
    queryKey: ["outcomeTokenHoldings", solanaAddress, positionKey],
    queryFn: async (): Promise<OutcomeTokenHolding[]> => {
      if (!solanaAddress) return [];

      try {
        const response = await cuspApiFetch<OutcomeHoldingsApiResponse>(
          `/api/wallet/outcome-holdings?wallet_address=${encodeURIComponent(solanaAddress)}`
        );
        const normalized = (response.holdings ?? []).map(mapApiHolding);
        if (normalized.length > 0) {
          return enrichWithLiveMarketData(normalized);
        }

        const frontendScanned = await scanWalletOutcomeHoldingsFromMainnet(solanaAddress);
        if (frontendScanned.length > 0) {
          return frontendScanned;
        }

        return [];
      } catch (error) {
        console.warn("[outcomeTokens] API holdings fetch failed, falling back to frontend mainnet scan:", error);
        const frontendScanned = await scanWalletOutcomeHoldingsFromMainnet(solanaAddress);
        if (frontendScanned.length > 0) {
          return frontendScanned;
        }

        console.warn("[outcomeTokens] Frontend scan found nothing, falling back to portfolio only.");
        const merged = mergePortfolioFallback([], portfolio);
        return enrichWithLiveMarketData(merged);
      }
    },
    enabled: !!solanaAddress && isConnected,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
