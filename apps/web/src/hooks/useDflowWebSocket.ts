import { useEffect, useRef, useState, useCallback } from "react";
import {
  DFLOW_WS_URL,
  subscribe,
  unsubscribe,
  getReconnectDelay,
  type PriceUpdate,
  type TradeUpdate,
  type OrderbookUpdate,
} from "@/lib/dflow-ws";

export interface LivePrices {
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
}

export interface LiveOrderbook {
  yes_bids: Record<string, string>;
  no_bids: Record<string, string>;
}

export interface LiveTrade {
  tradeId: string;
  yesPrice: number;
  noPrice: number;
  takerSide: "yes" | "no";
  count: number;
  createdTime: number;
}

export function useDflowWebSocket(ticker: string | undefined) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [orderbook, setOrderbook] = useState<LiveOrderbook | null>(null);
  const [orderbookUpdatedAt, setOrderbookUpdatedAt] = useState<number | null>(null);
  const [recentTrades, setRecentTrades] = useState<LiveTrade[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const tickerRef = useRef(ticker);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  tickerRef.current = ticker;

  const connect = useCallback(() => {
    if (!ticker || !DFLOW_WS_URL) return;

    const ws = new WebSocket(DFLOW_WS_URL);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttemptRef.current = 0;
      subscribe(ws, "prices", [ticker]);
      subscribe(ws, "orderbook", [ticker]);
      subscribe(ws, "trades", [ticker]);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as PriceUpdate | TradeUpdate | OrderbookUpdate;
        if (msg.market_ticker !== tickerRef.current) return;

        switch (msg.channel) {
          case "prices": {
            const p = msg as PriceUpdate;
            setPrices({
              yesBid: p.yes_bid != null ? parseFloat(p.yes_bid) : null,
              yesAsk: p.yes_ask != null ? parseFloat(p.yes_ask) : null,
              noBid: p.no_bid != null ? parseFloat(p.no_bid) : null,
              noAsk: p.no_ask != null ? parseFloat(p.no_ask) : null,
            });
            break;
          }
          case "orderbook": {
            const o = msg as OrderbookUpdate;
            const yesBids: Record<string, string> = {};
            const noBids: Record<string, string> = {};
            for (const [k, v] of Object.entries(o.yes_bids ?? {})) yesBids[k] = String(v);
            for (const [k, v] of Object.entries(o.no_bids ?? {})) noBids[k] = String(v);
            setOrderbook({ yes_bids: yesBids, no_bids: noBids });
            setOrderbookUpdatedAt(Date.now());
            break;
          }
          case "trades": {
            const t = msg as TradeUpdate;
            setRecentTrades((prev) => {
              const next = [
                {
                  tradeId: t.trade_id,
                  yesPrice: parseFloat(t.yes_price_dollars),
                  noPrice: parseFloat(t.no_price_dollars),
                  takerSide: t.taker_side,
                  count: t.count,
                  createdTime: t.created_time,
                },
                ...prev.slice(0, 49),
              ];
              return next;
            });
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      wsRef.current = null;
      setStatus("disconnected");
      if (ticker) {
        const delay = getReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
      }
    };
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        unsubscribe(wsRef.current, "prices", [ticker]);
        unsubscribe(wsRef.current, "orderbook", [ticker]);
        unsubscribe(wsRef.current, "trades", [ticker]);
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("disconnected");
      setPrices(null);
      setOrderbook(null);
      setOrderbookUpdatedAt(null);
      setRecentTrades([]);
    };
  }, [ticker, connect]);

  return {
    status,
    isLive: status === "connected",
    prices,
    orderbook,
    orderbookUpdatedAt,
    recentTrades,
  };
}
