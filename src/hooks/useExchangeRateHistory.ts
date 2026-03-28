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
      return (data as RateSnapshot[]) ?? [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
