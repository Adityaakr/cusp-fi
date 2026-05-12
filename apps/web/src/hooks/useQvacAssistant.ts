import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { AnyQvacCommand, Asset, QvacAssistantIntent, QvacAssistantPreviewResult } from "@cusp/shared";
import { usePhantom } from "@/lib/wallet";
import { cuspApiFetch, cuspApiUrl } from "@/lib/cusp-api";
import { checkQvacAvailability, qvacChatJson, qvacTranscribe } from "@/lib/qvac-local";
import { useKalshiMarket } from "@/hooks/useKalshiMarkets";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useOutcomeTokenHoldings } from "@/hooks/useOutcomeTokenHoldings";
import { useBorrowPanelRows } from "@/hooks/useBorrowPanelRows";
import type { BorrowPanelRow } from "@/hooks/useBorrowPanelRows";
import { useQvac } from "@/components/qvac/QvacProvider";
import { OUTCOME_LIQUIDATION_THRESHOLD_BPS, OUTCOME_MAX_LTV_BPS } from "@/lib/protocol-constants";
import { useLendingPool } from "@/hooks/useLendingPool";
import { useCreateOutcomeLoan } from "@/hooks/useCreateOutcomeLoan";
import { useMainnetPoolLiquidity } from "@/hooks/useMainnetPoolLiquidity";

interface AssistantEnvelope {
  assistant_message: string;
  intent: QvacAssistantIntent["type"];
  service?: QvacAssistantIntent["service"];
  action?: QvacAssistantIntent["action"];
  market_reference_text?: string;
  position_reference_text?: string;
  side?: "yes" | "no";
  amount_ui?: number;
  leverage?: number;
  asset?: string;
  pool?: string;
  collateral_asset?: string;
  borrow_asset?: string;
  borrow_amount_ui?: number;
  repay_asset?: string;
  repay_amount_ui?: number;
  risk_mode?: string;
  confidence?: number;
  needs_confirmation?: boolean;
  missing_fields?: string[];
}

const CONFIRMING_INTENTS = new Set<QvacAssistantIntent["type"]>([
  "direct_trade",
  "leverage_open",
  "leverage_close",
  "lend_deposit",
  "lend_withdraw",
  "borrow_open",
  "borrow_close",
]);

function formatBorrowCapacity(rows: BorrowPanelRow[]): string {
  if (!rows.length) {
    return [
      "No outcome-token collateral was found for borrow estimates.",
      "Hold YES/NO outcome tokens (from prediction positions) to unlock borrowing against them, or connect the wallet that holds them.",
    ].join("\n");
  }

  const lines = rows.map(
    (r) =>
      `• ${r.marketLabel} (${r.side}): collateral ~$${r.collateralUsd.toFixed(2)} · max borrow ~$${r.maxBorrowUsd.toFixed(2)} · safer borrow ~$${r.safeBorrowUsd.toFixed(2)}`
  );
  const totalMax = rows.reduce((sum, r) => sum + r.maxBorrowUsd, 0);
  return [
    "Estimated borrow capacity against your outcome tokens (protocol max LTV):",
    "",
    ...lines,
    "",
    `Combined max if you used every position: ~$${totalMax.toFixed(2)}.`,
  ].join("\n");
}

function buildPrompt(params: {
  walletConnected: boolean;
  currentPath: string;
  currentMarketTicker?: string;
  currentMarketTitle?: string;
  openPositions: Array<{ market_ticker: string; market_title?: string; side: string; position_type: string }>;
  borrowCapacityLines: string[];
}) {
  const borrowBlock =
    params.borrowCapacityLines.length > 0
      ? `Outcome-token borrow snapshot (per position):\n${params.borrowCapacityLines.join("\n")}`
      : "Outcome-token borrow snapshot: none (no eligible holdings).";

  return [
    "You are CUSP's local trading and lending copilot.",
    "Return JSON only. No markdown. No prose. No preface. No explanation.",
    "Your entire reply must be exactly one valid JSON object.",
    "Do not say words like 'Okay', 'Sure', or 'Here is the JSON'.",
    "Interpret the user's request into a single object with keys:",
    "assistant_message, intent, service, action, market_reference_text, position_reference_text, side, amount_ui, leverage, confidence, needs_confirmation, missing_fields.",
    "Optional keys when relevant: asset, pool, collateral_asset, borrow_asset, borrow_amount_ui, repay_asset, repay_amount_ui, risk_mode (safe|moderate|aggressive).",
    "Allowed intent values: direct_trade, leverage_open, leverage_close, lend_deposit, lend_withdraw, borrow_open, borrow_close, borrow_capacity, market_search, position_summary, risk_explain, unknown.",
    "Every reply must include at least: assistant_message, intent, confidence, needs_confirmation, missing_fields.",
    "missing_fields must always be an array.",
    "If information is missing, set intent to the best matching intent and list the missing fields instead of asking a question outside JSON.",
    'Example valid reply: {"assistant_message":"I can help with that.","intent":"borrow_open","service":"borrow","action":"open","amount_ui":200,"borrow_amount_ui":100,"collateral_asset":"USDC","borrow_asset":"USDC","confidence":0.86,"needs_confirmation":true,"missing_fields":[]}',
    "Rules:",
    "- Never execute anything.",
    "- If user wants to buy or trade on a market, prefer direct_trade unless leverage is explicit.",
    "- If user asks to close a leveraged trade position, prefer leverage_close.",
    "- lend_deposit / lend_withdraw: service lend, pool conservative|moderate|growth, amount_ui is USDC amount.",
    "- Lending is not market-specific. For lend_deposit / lend_withdraw, do not ask for or infer a market unless the user explicitly asks to trade.",
    "- borrow_open: collateral in amount_ui, loan size in borrow_amount_ui, collateral_asset and borrow_asset should be USDC for now.",
    "- If the user says borrow, loan, collateral, against my positions, against my open positions, or against my outcome tokens, prefer borrow_open or borrow_capacity — not lend_deposit.",
    "- If the user mentions open positions / my positions / outcome tokens but gives no borrow size, prefer borrow_capacity or borrow_open with missing_fields, not any lend intent.",
    "- Only use lend_deposit / lend_withdraw when the user explicitly wants to lend, supply, deposit into a pool, or withdraw from a pool.",
    "- borrow_close: repay_amount_ui and amount_ui (collateral to unlock), repay_asset.",
    "- For questions like max loan, how much can I borrow on my positions, borrow_capacity intent — assistant_message should briefly tee up that numeric estimates follow client-side.",
    "- If the market is implied by current page context, you may omit market_reference_text.",
    "- needs_confirmation should be true for any financial action.",
    `Wallet connected: ${params.walletConnected ? "yes" : "no"}.`,
    `Current path: ${params.currentPath}.`,
    params.currentPath.startsWith("/lend")
      ? "This is the lend/borrow page. 'Lend', 'supply', or 'deposit' here refers to supplying USDC into the lending pool / vault, not choosing a prediction market."
      : "Page-specific lending override: none.",
    params.currentMarketTicker
      ? `Current market context: ${params.currentMarketTitle ?? params.currentMarketTicker} (${params.currentMarketTicker}).`
      : "Current market context: none.",
    `Open positions: ${params.openPositions.length ? params.openPositions.map((p) => `${p.market_title ?? p.market_ticker} ${p.side} ${p.position_type}`).join("; ") : "none"}.`,
    borrowBlock,
  ].join("\n");
}

function toIntent(envelope: AssistantEnvelope): QvacAssistantIntent {
  const type = envelope.intent ?? "unknown";
  return {
    type,
    service: envelope.service,
    action: envelope.action,
    assistant_message: envelope.assistant_message || "I've prepared that request.",
    market_reference_text: envelope.market_reference_text,
    position_reference_text: envelope.position_reference_text,
    side: envelope.side,
    amount_ui: envelope.amount_ui,
    leverage: envelope.leverage,
    asset: envelope.asset as Asset | undefined,
    pool: envelope.pool,
    collateral_asset: envelope.collateral_asset as Asset | undefined,
    borrow_asset: envelope.borrow_asset as Asset | undefined,
    borrow_amount_ui: envelope.borrow_amount_ui,
    repay_asset: envelope.repay_asset as Asset | undefined,
    repay_amount_ui: envelope.repay_amount_ui,
    risk_mode: envelope.risk_mode as QvacAssistantIntent["risk_mode"],
    confidence: envelope.confidence ?? 0.7,
    needs_confirmation: envelope.needs_confirmation ?? CONFIRMING_INTENTS.has(type),
    missing_fields: envelope.missing_fields ?? [],
  };
}

function normalizeMessage(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeAssistantInput(message: string): string {
  return message.replace(/\budsc\b/gi, "USDC");
}

function extractAmountFromMessage(message: string): number | undefined {
  const matches = message.match(/\b\d+(?:\.\d+)?\b/g);
  if (!matches?.length) return undefined;

  for (const match of matches) {
    const parsed = Number(match);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function repairIntentFromMessage(message: string, intent: QvacAssistantIntent, currentPath: string): QvacAssistantIntent {
  const sanitizedMessage = sanitizeAssistantInput(message);
  const normalized = normalizeMessage(sanitizedMessage);
  const wantsBorrow = /\b(borrow|loan)\b/.test(normalized);
  const wantsLend = /\b(lend|lending|supply)\b/.test(normalized) || /\bdeposit\b/.test(normalized);
  const wantsWithdraw = /\b(withdraw|unstake|redeem)\b/.test(normalized);
  const mentionsTrading = /\b(trade|buy|sell|market|yes|no|long|short)\b/.test(normalized);
  const mentionsPool = /\b(pool|conservative|moderate|growth)\b/.test(normalized);
  const mentionsVault = /\b(vault|earn)\b/.test(normalized);
  const mentionsPositions = /(open positions|my positions|outcome tokens|against my position|against my open position|against my positions)/.test(normalized);
  const hasBorrowAmount = typeof intent.borrow_amount_ui === "number" && intent.borrow_amount_ui > 0;
  const extractedAmount = extractAmountFromMessage(sanitizedMessage);
  const resolvedAmount = typeof intent.amount_ui === "number" && intent.amount_ui > 0 ? intent.amount_ui : extractedAmount;
  const hasCollateralAmount = typeof resolvedAmount === "number" && resolvedAmount > 0;
  const forceLendIntent =
    currentPath.startsWith("/lend") &&
    !wantsBorrow &&
    !mentionsPositions &&
    !mentionsTrading &&
    (wantsLend || wantsWithdraw || mentionsPool || mentionsVault);

  if ((wantsLend || wantsWithdraw || mentionsPool || mentionsVault || forceLendIntent) && !wantsBorrow) {
    if (
      forceLendIntent ||
      intent.type === "unknown" ||
      intent.type === "market_search" ||
      intent.type === "direct_trade" ||
      intent.type === "leverage_open"
    ) {
      return {
        ...intent,
        type: wantsWithdraw ? "lend_withdraw" : "lend_deposit",
        service: "lend",
        action: wantsWithdraw ? "withdraw" : "deposit",
        amount_ui: resolvedAmount,
        assistant_message: wantsWithdraw
          ? "I can help withdraw from the lending pool directly."
          : "I can help deposit into the lending pool directly.",
        missing_fields: hasCollateralAmount ? (intent.missing_fields ?? []) : Array.from(new Set([...(intent.missing_fields ?? []), "amount_ui"])),
      };
    }

    if ((intent.type === "lend_deposit" || intent.type === "lend_withdraw") && hasCollateralAmount) {
      return {
        ...intent,
        amount_ui: resolvedAmount,
        missing_fields: (intent.missing_fields ?? []).filter((field) => field !== "amount_ui"),
      };
    }
  }

  if (wantsBorrow && !wantsLend) {
    if (intent.type === "lend_deposit" || intent.type === "lend_withdraw") {
      return {
        ...intent,
        type: mentionsPositions && !hasBorrowAmount && !hasCollateralAmount ? "borrow_capacity" : "borrow_open",
        service: "borrow",
        action: "open",
        borrow_asset: intent.borrow_asset ?? "USDC",
        collateral_asset: intent.collateral_asset ?? "USDC",
        borrow_amount_ui: hasBorrowAmount ? intent.borrow_amount_ui : extractedAmount,
        missing_fields:
          mentionsPositions && !hasBorrowAmount && !hasCollateralAmount
            ? []
            : Array.from(
                new Set([
                  ...(intent.missing_fields ?? []),
                  ...(!hasBorrowAmount && !extractedAmount ? ["borrow_amount_ui"] : []),
                ])
              ),
        assistant_message:
          mentionsPositions && !hasBorrowAmount && !hasCollateralAmount
            ? "I can estimate how much you can borrow against your open positions."
            : intent.assistant_message,
      };
    }

    if (mentionsPositions && intent.type === "unknown") {
      return {
        ...intent,
        type: extractedAmount ? "borrow_open" : "borrow_capacity",
        service: "borrow",
        action: "open",
        borrow_asset: intent.borrow_asset ?? "USDC",
        collateral_asset: intent.collateral_asset ?? "USDC",
        borrow_amount_ui: extractedAmount,
        assistant_message: extractedAmount
          ? `I can help borrow ${extractedAmount} USDC against one of your open positions.`
          : "I can estimate how much you can borrow against your open positions.",
        missing_fields: extractedAmount ? [] : [],
      };
    }
  }

  return intent;
}

function buildLocalFallbackIntent(message: string, currentPath: string): QvacAssistantIntent {
  const extractedAmount = extractAmountFromMessage(sanitizeAssistantInput(message));
  return repairIntentFromMessage(
    message,
    {
      type: "unknown",
      assistant_message: extractedAmount
        ? `I interpreted this as a ${currentPath.startsWith("/lend") ? "lend/borrow" : "QVAC"} request for ${extractedAmount} USDC.`
        : "I interpreted your request and prepared the closest matching QVAC action.",
      confidence: 0.45,
      needs_confirmation: true,
      missing_fields: [],
    },
    currentPath
  );
}

function normalizeLookupText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function rowMatchesReference(row: BorrowPanelRow, reference: string): boolean {
  const needle = normalizeLookupText(reference);
  if (!needle) return false;

  return [
    row.id,
    row.marketLabel,
    row.ticker ?? "",
    row.outcomeMint,
    row.side,
  ].some((candidate) => normalizeLookupText(candidate).includes(needle));
}

function formatBorrowOfferMessage(params: {
  row: BorrowPanelRow;
  borrowAmount: number;
  requestedAmount?: number;
  exceedsMax?: boolean;
}) {
  const maxBorrow = Number(params.row.maxBorrowUsd.toFixed(2));
  const safeBorrow = Number(params.row.safeBorrowUsd.toFixed(2));
  const borrowAmount = Number(params.borrowAmount.toFixed(2));

  if (params.exceedsMax && params.requestedAmount) {
    return [
      `For ${params.row.marketLabel}, max borrowable is $${maxBorrow.toFixed(2)} USDC and max safe borrowable is $${safeBorrow.toFixed(2)} USDC.`,
      `Your requested $${params.requestedAmount.toFixed(2)} is above the max, so I queued the safe amount instead.`,
      `Say "yes" to borrow $${borrowAmount.toFixed(2)} USDC, or tell me another amount up to $${maxBorrow.toFixed(2)}.`,
    ].join(" ");
  }

  return [
    `For ${params.row.marketLabel}, max borrowable is $${maxBorrow.toFixed(2)} USDC and max safe borrowable is $${safeBorrow.toFixed(2)} USDC.`,
    `Say "yes" to borrow $${borrowAmount.toFixed(2)} USDC, or tell me another amount.`,
  ].join(" ");
}

export function useQvacAssistant() {
  const { addresses, isConnected } = usePhantom();
  const { state } = useQvac();
  const { ticker } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const wallet = addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address;
  const { data: currentMarket } = useKalshiMarket(ticker);
  const { data: portfolio } = useUserPortfolio();
  const { data: holdings = [] } = useOutcomeTokenHoldings(portfolio ?? undefined);
  const { rows: borrowRows } = useBorrowPanelRows(portfolio ?? undefined, holdings);
  const { data: poolState } = useLendingPool(wallet);
  const { supply, withdraw } = useMainnetPoolLiquidity(poolState?.poolPublicKey);
  const { createLoan, reset: resetLoan } = useCreateOutcomeLoan();
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const borrowCapacityLines = useMemo(
    () =>
      borrowRows.map(
        (r) =>
          `${r.marketLabel} (${r.side}): collateral ~$${r.collateralUsd.toFixed(2)}, max ~$${r.maxBorrowUsd.toFixed(2)}, safer ~$${r.safeBorrowUsd.toFixed(2)}`
      ),
    [borrowRows]
  );

  const currentContext = useMemo(
    () => ({
      current_market_ticker: state.assistantContext?.current_market_ticker ?? currentMarket?.ticker,
      current_market_title: state.assistantContext?.current_market_title ?? currentMarket?.name,
      position_id: state.assistantContext?.position_id,
    }),
    [currentMarket?.ticker, currentMarket?.name, state.assistantContext]
  );

  async function previewIntent(intent: QvacAssistantIntent): Promise<QvacAssistantPreviewResult> {
    const previewRes = await fetch(cuspApiUrl("/api/qvac/assistant/preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        context: {
          wallet_address: wallet,
          ...currentContext,
        },
      }),
    });

    const preview = (await previewRes.json()) as QvacAssistantPreviewResult;
    return preview.success ? preview : { ...preview, intent: preview.intent ?? intent };
  }

  async function interpret(message: string): Promise<QvacAssistantPreviewResult> {
    const available = await checkQvacAvailability();
    if (!available) {
      throw new Error("Local QVAC runtime not found. Start it with `qvac serve openai --cors`.");
    }

    const prompt = buildPrompt({
      walletConnected: !!wallet && isConnected,
      currentPath: location.pathname,
      currentMarketTicker: currentContext.current_market_ticker,
      currentMarketTitle: currentContext.current_market_title,
      openPositions: (portfolio?.positions ?? []).filter((position) => position.status === "open"),
      borrowCapacityLines,
    });

    let intent: QvacAssistantIntent;
    try {
      const envelope = await qvacChatJson<AssistantEnvelope>([
        { role: "system", content: prompt },
        { role: "user", content: sanitizeAssistantInput(message) },
      ]);
      intent = repairIntentFromMessage(message, toIntent(envelope), location.pathname);
    } catch (error) {
      console.warn("[qvac][interpret] falling back to local intent inference", {
        message,
        error: error instanceof Error ? error.message : error,
      });
      intent = buildLocalFallbackIntent(message, location.pathname);
    }

    if (intent.type === "borrow_capacity") {
      intent = {
        ...intent,
        assistant_message: formatBorrowCapacity(borrowRows),
      };
      return { success: true, intent };
    }

    if (intent.type === "borrow_open") {
      const hasExplicitBorrowAmount = typeof intent.borrow_amount_ui === "number" && intent.borrow_amount_ui > 0;
      const references = [
        intent.position_reference_text,
        intent.market_reference_text,
        currentContext.position_id,
        currentContext.current_market_ticker,
        currentContext.current_market_title,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

      const matchedBorrowRows = references.length
        ? borrowRows.filter((row) => references.some((reference) => rowMatchesReference(row, reference)))
        : borrowRows.length === 1
          ? [borrowRows[0]]
          : [];

      if (matchedBorrowRows.length === 1) {
        const row = matchedBorrowRows[0];
        const safeBorrow = Number(row.safeBorrowUsd.toFixed(2));
        const maxBorrow = Number(row.maxBorrowUsd.toFixed(2));
        const requestedBorrowAmount = hasExplicitBorrowAmount ? Number(intent.borrow_amount_ui!.toFixed(2)) : undefined;
        const borrowAmount =
          requestedBorrowAmount && requestedBorrowAmount > 0
            ? Math.min(requestedBorrowAmount, maxBorrow)
            : safeBorrow;

        const enrichedIntent: QvacAssistantIntent = {
          ...intent,
          position_reference_text: row.id,
          market_reference_text: row.ticker ?? row.marketLabel,
          amount_ui: Number(row.collateralUsd.toFixed(2)),
          collateral_asset: intent.collateral_asset ?? "USDC",
          borrow_asset: "USDC",
          borrow_amount_ui: Number(borrowAmount.toFixed(2)),
          missing_fields: [],
          assistant_message: formatBorrowOfferMessage({
            row,
            borrowAmount,
            requestedAmount: requestedBorrowAmount,
            exceedsMax: Boolean(requestedBorrowAmount && requestedBorrowAmount > maxBorrow),
          }),
        };

        const preview = await previewIntent(enrichedIntent);
        return preview.success
          ? {
              ...preview,
              intent: {
                ...preview.intent,
                assistant_message: enrichedIntent.assistant_message,
              },
            }
          : preview;
      }

      if (!intent.position_reference_text) {
        return {
          success: true,
          intent: {
            ...intent,
            collateral_asset: intent.collateral_asset ?? "USDC",
            borrow_asset: "USDC",
            assistant_message: borrowRows.length
              ? hasExplicitBorrowAmount
                ? `Select one open position in the side panel. I’ll show its max borrowable amount and max safe borrowable amount before you confirm ${intent.borrow_amount_ui?.toFixed?.(2) ?? intent.borrow_amount_ui} USDC.`
                : "Select one open position in the side panel. I’ll show its max borrowable amount and max safe borrowable amount before you confirm."
              : "I couldn't find any borrow-eligible open positions in your wallet.",
            needs_confirmation: true,
            missing_fields: borrowRows.length ? [] : ["open_position"],
          },
          candidates: borrowRows.map((row) => ({
            kind: "position" as const,
            id: row.id,
            label: `${row.marketLabel} · ${row.side}`,
            subtitle: `Max borrow $${row.maxBorrowUsd.toFixed(2)} USDC · collateral $${row.collateralUsd.toFixed(2)}`,
          })),
        };
      }
    }

    return previewIntent(intent);
  }

  async function execute(preview: QvacAssistantPreviewResult): Promise<{ navigateTo?: string; txSignature?: string; error?: string }> {
    console.info("[qvac][execute] start", {
      intentType: preview.intent.type,
      intent: preview.intent,
      hasCommand: Boolean(preview.command),
    });

    if (preview.intent.type === "borrow_open" && preview.intent.position_reference_text) {
      const selected = borrowRows.find((row) => row.id === preview.intent.position_reference_text);
      const borrowAmount = preview.intent.borrow_amount_ui ?? 0;
      if (!selected) return { error: "Selected borrow position is no longer available." };
      if (!(borrowAmount > 0)) return { error: "Missing borrow amount." };
      if ((poolState?.availableLiquidity ?? 0) < borrowAmount) {
        return { error: `Pool has only $${(poolState?.availableLiquidity ?? 0).toFixed(2)} USDC available.` };
      }

      resetLoan();
      const loanId = await createLoan({
        walletAddress: wallet ?? "",
        marketTicker: selected.ticker ?? "unknown",
        side: selected.side,
        outcomeMint: selected.outcomeMint,
        tokenQuantity: selected.quantity,
        tokenDecimals: selected.decimals,
        tokenProgram: selected.tokenProgram,
        currentPrice: selected.currentPrice,
        collateralValueUsdc: selected.collateralUsd,
        borrowAmountUsdc: borrowAmount,
        maxLtvBps: OUTCOME_MAX_LTV_BPS,
        liquidationThresholdBps: OUTCOME_LIQUIDATION_THRESHOLD_BPS,
        poolPublicKey: poolState?.poolPublicKey || "",
      });

      if (!loanId) return { error: "Borrow failed." };
      return { txSignature: "confirmed" };
    }

    if (!preview.command) {
      console.warn("[qvac][execute] aborted: missing command", {
        intentType: preview.intent.type,
      });
      return { error: "No executable command prepared." };
    }

    if (preview.intent.type === "lend_deposit") {
      const amount = preview.intent.amount_ui ?? preview.command.amount_ui ?? 0;
      if (!(amount > 0)) return { error: "Missing lend amount." };
      console.info("[qvac][execute] lend deposit via mainnet pool", {
        amount,
        poolPublicKey: poolState?.poolPublicKey ?? null,
      });
      const signature = await supply(amount);
      if (!signature) {
        console.error("[qvac][execute] lend deposit failed", {
          amount,
          poolPublicKey: poolState?.poolPublicKey ?? null,
        });
        return {
          error:
            "Lending deposit failed. Check browser console logs for [mainnet-pool][supply] to see whether it failed at wallet signing, on-chain confirmation, or backend registration.",
        };
      }
      console.info("[qvac][execute] lend deposit success", { signature, amount });
      return { txSignature: signature };
    }

    if (preview.intent.type === "lend_withdraw") {
      const amount = preview.intent.amount_ui ?? preview.command.amount_ui ?? 0;
      if (!(amount > 0)) return { error: "Missing withdraw amount." };
      console.info("[qvac][execute] lend withdraw via mainnet pool", { amount });
      const signature = await withdraw(amount);
      if (!signature) {
        console.error("[qvac][execute] lend withdraw failed", { amount });
        return {
          error:
            "Lending withdraw failed. Check browser console logs for [mainnet-pool][withdraw] for the exact backend error.",
        };
      }
      console.info("[qvac][execute] lend withdraw success", { signature, amount });
      return { txSignature: signature };
    }

    if (preview.intent.type === "direct_trade" || preview.intent.type === "leverage_open") {
      const command = preview.command as AnyQvacCommand & { market_query: string; side: "yes" | "no"; leverage?: number };
      const params = new URLSearchParams();
      params.set("side", command.side.toUpperCase());
      params.set("openTrade", "1");
      params.set("qvacAmount", String(preview.intent.amount_ui ?? 0));
      if (preview.intent.type === "leverage_open") {
        const rounded =
          preview.intent.leverage && preview.intent.leverage >= 2.5
            ? 3
            : preview.intent.leverage && preview.intent.leverage >= 1.5
              ? 2
              : 1;
        params.set("leverage", String(rounded));
      }
      const href = `/markets/${command.market_query}?${params.toString()}`;
      navigate(href);
      return { navigateTo: href };
    }

    const data = await cuspApiFetch<{
      success: boolean;
      data?: { tx_signature?: string } & Record<string, unknown>;
      error?: string;
    }>("/api/qvac/assistant/execute", {
      method: "POST",
      body: JSON.stringify({
        intent: preview.intent,
        command: preview.command,
      }),
    });
    console.info("[qvac][execute] assistant execute API response", {
      intentType: preview.intent.type,
      data,
    });
    const txSignature =
      typeof data.data?.tx_signature === "string"
        ? data.data.tx_signature
        : typeof data.data?.txSignature === "string"
          ? (data.data.txSignature as string)
          : undefined;
    return { txSignature };
  }

  async function startVoiceCapture(): Promise<void> {
    if (recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();
    setRecording(true);
  }

  async function stopVoiceCapture(): Promise<string> {
    const recorder = recorderRef.current;
    if (!recorder) return "";

    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const text = await qvacTranscribe(blob);
          recorder.stream.getTracks().forEach((track) => track.stop());
          recorderRef.current = null;
          chunksRef.current = [];
          setRecording(false);
          resolve(text);
        } catch (error) {
          setRecording(false);
          reject(error);
        }
      };
      recorder.stop();
    });
  }

  return {
    currentContext,
    recording,
    borrowRows,
    poolState,
    interpret,
    previewIntent,
    execute,
    startVoiceCapture,
    stopVoiceCapture,
  };
}
