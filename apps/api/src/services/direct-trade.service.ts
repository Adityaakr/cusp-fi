import { getAdminClient } from "../db/supabase.js";
import { fetchOrderQuote, fetchMarket } from "./dflow-adapter.service.js";
import { getConnection, getVaultKeypair, USDC_MINT } from "../solana/connection.js";
import { VersionedTransaction } from "@solana/web3.js";
import { USDC_MINT_MAINNET } from "@cusp/shared/constants";

export interface DirectTradeResult {
  success: boolean;
  position_id?: string;
  trade_execution_id?: string;
  execution_route?: string;
  input_amount?: number;
  output_amount?: number;
  tx_signature?: string;
  error?: string;
}

export async function processDirectTrade(params: {
  wallet_address: string;
  input_asset: string;
  input_amount_ui: number;
  market_query: string;
  side: "yes" | "no";
  max_slippage_bps: number;
}): Promise<DirectTradeResult> {
  const { wallet_address, input_amount_ui, market_query, side, max_slippage_bps } = params;
  const supabase = getAdminClient();

  let market: any;
  try {
    market = await fetchMarket(market_query);
  } catch (err) {
    return { success: false, error: `Market not found: ${market_query}` };
  }

  if (market.status !== "active") {
    return { success: false, error: `Market is ${market.status}, not active` };
  }

  const accounts: any[] = Object.values(market.accounts || {});
  const firstAccount = accounts[0] || {};
  const outputMint = side === "yes" ? firstAccount.yesMint : firstAccount.noMint;

  if (!outputMint) {
    return { success: false, error: "Could not determine outcome mint" };
  }

  const inputMint = USDC_MINT_MAINNET;
  const amountAtomic = Math.round(input_amount_ui * 1e6);

  let quote;
  try {
    quote = await fetchOrderQuote({
      userPublicKey: wallet_address,
      inputMint,
      outputMint,
      amount: amountAtomic,
      slippageBps: max_slippage_bps,
    });
  } catch (err) {
    return { success: false, error: `DFlow quote failed: ${err instanceof Error ? err.message : err}` };
  }

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const { data: position } = await supabase
    .from("positions")
    .insert({
      position_type: "direct",
      user_id: userId,
      market_ticker: market_query,
      side,
      entry_price: quote.outputAmount / amountAtomic,
      quantity: input_amount_ui,
      usdc_cost: input_amount_ui,
      outcome_mint: outputMint,
      status: "open",
    })
    .select()
    .single();

  const { data: tradeExecution } = await supabase
    .from("trade_executions")
    .insert({
      position_id: position?.id,
      direction: "buy",
      input_mint: inputMint,
      output_mint: outputMint,
      input_amount: input_amount_ui,
      output_amount: quote.outputAmount / 1e6,
      status: "quote_ready",
    })
    .select()
    .single();

  const executionRoute = input_asset_needs_swap(inputMint)
    ? "USDT → USDC → YES/NO"
    : "USDC → YES/NO";

  return {
    success: true,
    position_id: position?.id,
    trade_execution_id: tradeExecution?.id,
    execution_route: executionRoute,
    input_amount: input_amount_ui,
    output_amount: quote.outputAmount / 1e6,
  };
}

function input_asset_needs_swap(inputMint: string): boolean {
  return inputMint !== USDC_MINT_MAINNET;
}

export async function executeDirectTrade(params: {
  position_id: string;
}): Promise<DirectTradeResult> {
  const { position_id } = params;
  const supabase = getAdminClient();

  const { data: position } = await supabase
    .from("positions")
    .select("*, trade_executions(*)")
    .eq("id", position_id)
    .single();

  if (!position) {
    return { success: false, error: "Position not found" };
  }

  const connection = getConnection();
  const vaultKeypair = getVaultKeypair();

  const quote = await fetchOrderQuote({
    userPublicKey: position.outcome_mint ? vaultKeypair.publicKey.toBase58() : position.user_wallet,
    inputMint: USDC_MINT_MAINNET,
    outputMint: position.outcome_mint,
    amount: Math.round(position.quantity * 1e6),
    slippageBps: "auto",
  });

  const txBuffer = Uint8Array.from(atob(quote.transaction), (c) => c.charCodeAt(0));
  const transaction = VersionedTransaction.deserialize(txBuffer);

  const signature = await connection.sendTransaction(transaction);

  await supabase
    .from("positions")
    .update({ status: "filled" })
    .eq("id", position_id);

  await supabase
    .from("trade_executions")
    .update({
      status: "submitted",
      tx_signature: signature,
    })
    .eq("position_id", position_id);

  return {
    success: true,
    position_id,
    tx_signature: signature,
  };
}
