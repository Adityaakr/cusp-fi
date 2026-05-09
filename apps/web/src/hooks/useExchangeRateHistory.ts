import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface RateSnapshot {
  exchange_rate: number;
  total_tvl: number;
  snapped_at: string;
}

export function useExchangeRateHistory(days = 90) {
  return useQuery<RateSnapshot[]>({
    queryKey: ["exchangeRateHistory", days],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.rpc("get_exchange_rate_history", {
        p_days: days,
      });
      if (error) throw error;
      return ((data as Array<Record<string, unknown>>) ?? []).map((row) => ({
        exchange_rate: Number(row.exchange_rate ?? 0),
        total_tvl: Number(row.total_tvl ?? 0),
        snapped_at: String(row.snapped_at ?? ""),
      }));
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
