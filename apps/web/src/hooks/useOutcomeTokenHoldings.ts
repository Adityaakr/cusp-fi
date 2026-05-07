import { useQuery } from "@tanstack/react-query";
import { usePhantom } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";
import type { UserPortfolio } from "@/hooks/useUserPortfolio";
import { MAINNET_USDC_MINT, USDC_MINT_ADDRESS } from "@/lib/network-config";

const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export type OutcomeTokenHolding = {
  mint: string;
  ataAddress: string;
  balance: number;
  decimals: number;
  ticker: string | null;
  title: string | null;
  side: "YES" | "NO" | null;
  program: "spl-token" | "token-2022";
};

function getMainnetRpcUrl(): string {
  if (import.meta.env.VITE_MAINNET_RPC_URL) return import.meta.env.VITE_MAINNET_RPC_URL;
  const devnetRpc = import.meta.env.VITE_SOLANA_RPC_URL || "";
  const m = devnetRpc.match(/https:\/\/devnet\.helius-rpc\.com\/\?api-key=(.+)/);
  if (m) return `https://mainnet.helius-rpc.com/?api-key=${m[1]}`;
  return "https://api.mainnet-beta.solana.com";
}

type TokenAccountInfo = {
  pubkey: string;
  owner: string;
  mint: string;
  balance: number;
  decimals: number;
};

const EXCLUDED_MINTS = new Set([
  MAINNET_USDC_MINT,
  USDC_MINT_ADDRESS,
  WSOL_MINT,
  import.meta.env.VITE_CUSDC_MINT || "",
].filter(Boolean));

async function fetchMainnetTokenAccounts(walletAddress: string): Promise<TokenAccountInfo[]> {
  const url = getMainnetRpcUrl();
  const results: TokenAccountInfo[] = [];

  for (const programId of [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    TOKEN_2022,
  ]) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            walletAddress,
            { programId },
            { encoding: "jsonParsed", commitment: "confirmed" },
          ],
        }),
      });
      const json = await res.json();
      if (json.error) {
        console.warn(`[outcomeTokens] RPC error (${programId.slice(0, 8)}):`, json.error.message);
        continue;
      }
      const accounts = json.result?.value ?? [];
      for (const acct of accounts) {
        const info = acct?.account?.data?.parsed?.info;
        const mint = info?.mint;
        if (!mint) continue;
        const ta = info.tokenAmount;
        let balance = 0;
        const decimals = ta?.decimals ?? 6;
        if (ta?.uiAmount != null && typeof ta.uiAmount === "number" && !Number.isNaN(ta.uiAmount)) {
          balance = ta.uiAmount;
        } else if (ta?.amount) {
          balance = Number(ta.amount) / 10 ** decimals;
        }
        results.push({
          pubkey: acct.pubkey,
          owner: acct.account?.owner ?? programId,
          mint,
          balance,
          decimals,
        });
      }
    } catch (e) {
      console.warn(`[outcomeTokens] Failed to fetch ${programId.slice(0, 8)} accounts:`, e);
    }
  }

  return results;
}

type MintMeta = { ticker: string; title: string; side: "YES" | "NO" };

function buildMintMeta(
  positions: UserPortfolio["positions"] | undefined,
  cacheRows: Array<{ ticker: string; title: string; yes_mint: string | null; no_mint: string | null }>
): Map<string, MintMeta> {
  const map = new Map<string, MintMeta>();

  for (const row of cacheRows) {
    if (row.yes_mint) map.set(row.yes_mint, { ticker: row.ticker, title: row.title, side: "YES" });
    if (row.no_mint) map.set(row.no_mint, { ticker: row.ticker, title: row.title, side: "NO" });
  }

  if (positions) {
    for (const p of positions) {
      if (!p.outcome_mint || p.status !== "open") continue;
      const side = p.side === "YES" || p.side === "NO" ? p.side : null;
      if (!side) continue;
      if (!map.has(p.outcome_mint)) {
        map.set(p.outcome_mint, { ticker: p.market_ticker, title: p.market_title ?? p.market_ticker, side });
      }
    }
  }

  return map;
}

export function useOutcomeTokenHoldings(portfolio: UserPortfolio | null | undefined) {
  const { addresses, isConnected } = usePhantom();
  const solanaAddress =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))
      ?.address ?? null;

  const positionKey = (portfolio?.positions ?? [])
    .filter((p) => p.status === "open" && p.outcome_mint)
    .map((p) => `${p.outcome_mint}:${p.market_ticker}:${p.side}`)
    .sort()
    .join("|");

  return useQuery({
    queryKey: ["outcomeTokenHoldings", solanaAddress, positionKey],
    queryFn: async (): Promise<OutcomeTokenHolding[]> => {
      if (!solanaAddress) return [];

      console.log("[outcomeTokens] fetching for wallet:", solanaAddress.slice(0, 8) + "...");

      // 1. Build mint metadata from markets_cache + positions
      let cacheRows: Array<{ ticker: string; title: string; yes_mint: string | null; no_mint: string | null }> = [];
      if (supabase) {
        try {
          const { data, error } = await supabase.from("markets_cache").select("ticker, title, yes_mint, no_mint");
          if (error) console.warn("[outcomeTokens] cache query error:", error.message);
          else cacheRows = data ?? [];
        } catch {
          console.warn("[outcomeTokens] cache query failed");
        }
      }

      const mintMeta = buildMintMeta(portfolio?.positions, cacheRows);
      console.log("[outcomeTokens] known outcome mints:", mintMeta.size, [...mintMeta.keys()].map(k => k.slice(0, 8)));

      if (mintMeta.size === 0) {
        console.log("[outcomeTokens] no known mints, skipping on-chain scan");
        return [];
      }

      // 2. Build baseline from position data (guaranteed to work)
      const holdingsMap = new Map<string, OutcomeTokenHolding>();
      for (const [mint, meta] of mintMeta) {
        if (EXCLUDED_MINTS.has(mint)) continue;
        const positionsForMint = (portfolio?.positions ?? []).filter(
          (p) => p.outcome_mint === mint && p.status === "open"
        );
        const estimatedBalance = positionsForMint.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
        if (estimatedBalance > 0) {
          holdingsMap.set(mint, {
            mint,
            ataAddress: "",
            balance: estimatedBalance,
            decimals: 6,
            ticker: meta.ticker,
            title: meta.title,
            side: meta.side,
            program: "token-2022",
          });
        }
      }

      console.log("[outcomeTokens] baseline from positions:", holdingsMap.size, "tokens");

      // 3. Enhance with on-chain data (override position estimates with real balances)
      try {
        const onChainAccounts = await fetchMainnetTokenAccounts(solanaAddress);
        console.log("[outcomeTokens] on-chain accounts:", onChainAccounts.length);

        for (const acct of onChainAccounts) {
          if (EXCLUDED_MINTS.has(acct.mint)) continue;
          if (acct.balance <= 0) continue;

          const meta = mintMeta.get(acct.mint);
          if (!meta) continue;

          holdingsMap.set(acct.mint, {
            mint: acct.mint,
            ataAddress: acct.pubkey,
            balance: acct.balance,
            decimals: acct.decimals,
            ticker: meta.ticker,
            title: meta.title,
            side: meta.side,
            program: acct.owner === TOKEN_2022 ? "token-2022" : "spl-token",
          });
        }
      } catch (e) {
        console.warn("[outcomeTokens] on-chain fetch failed, using position data:", e);
      }

      const result = Array.from(holdingsMap.values()).sort((a, b) => {
        const t = (a.ticker ?? "").localeCompare(b.ticker ?? "");
        if (t !== 0) return t;
        if (a.side === b.side) return 0;
        return a.side === "YES" ? -1 : 1;
      });

      console.log("[outcomeTokens] final result:", result.length, "tokens",
        result.map(h => `${h.ticker}/${h.side}=${h.balance}`));

      return result;
    },
    enabled: !!solanaAddress && isConnected,
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}
