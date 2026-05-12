/**
 * DFlow Metadata API WebSocket client
 * Docs: https://pond.dflow.net/build/metadata-api/websockets/overview
 */

import { DFLOW_WS_URL } from "./network-config";

export { DFLOW_WS_URL };

export type WsChannel = "prices" | "trades" | "orderbook";

export interface PriceUpdate {
  channel: "prices";
  type: string;
  market_ticker: string;
  yes_bid: string | null;
  yes_ask: string | null;
  no_bid: string | null;
  no_ask: string | null;
}

export interface TradeUpdate {
  channel: "trades";
  type: "trade";
  market_ticker: string;
  trade_id: string;
  price: number;
  count: number;
  yes_price: number;
  no_price: number;
  yes_price_dollars: string;
  no_price_dollars: string;
  taker_side: "yes" | "no";
  created_time: number;
}

export interface OrderbookUpdate {
  channel: "orderbook";
  type: string;
  market_ticker: string;
  yes_bids: Record<string, number>;
  no_bids: Record<string, number>;
}

export type WsMessage = PriceUpdate | TradeUpdate | OrderbookUpdate;

export function subscribe(ws: WebSocket, channel: WsChannel, tickers: string[]) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const msg =
    tickers.length > 0
      ? { type: "subscribe" as const, channel, tickers }
      : { type: "subscribe" as const, channel, all: true };
  ws.send(JSON.stringify(msg));
}

export function unsubscribe(ws: WebSocket, channel: WsChannel, tickers: string[]) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const msg =
    tickers.length > 0
      ? { type: "unsubscribe" as const, channel, tickers }
      : { type: "unsubscribe" as const, channel, all: true };
  ws.send(JSON.stringify(msg));
}

/** Exponential backoff: 1s, 2s, 4s, 8s, max 30s */
export function getReconnectDelay(attempt: number): number {
  const delay = Math.min(1000 * 2 ** attempt, 30_000);
  return delay + Math.random() * 1000;
}
