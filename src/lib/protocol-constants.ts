/**
 * Protocol limits mirrored in Supabase Edge Functions (_shared/protocol.ts).
 * Change both places together when adjusting min trade / max leverage.
 */

/** Minimum USDT for a direct trade or for leveraged margin (same floor). */
export const MIN_TRADE_USDC = 1;

export const MAX_PROTOCOL_LEVERAGE = 3;
