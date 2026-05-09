import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
    "Return JSON only. No markdown.",
    "Interpret the user's request into a single object with keys:",
    "assistant_message, intent, service, action, market_reference_text, position_reference_text, side, amount_ui, leverage, confidence, needs_confirmation, missing_fields.",
    "Optional keys when relevant: asset, pool, collateral_asset, borrow_asset, borrow_amount_ui, repay_asset, repay_amount_ui, risk_mode (safe|moderate|aggressive).",
    "Allowed intent values: direct_trade, leverage_open, leverage_close, lend_deposit, lend_withdraw, borrow_open, borrow_close, borrow_capacity, market_search, position_summary, risk_explain, unknown.",
    "Rules:",
    "- Never execute anything.",
    "- If user wants to buy or trade on a market, prefer direct_trade unless leverage is explicit.",
    "- If user asks to close a leveraged trade position, prefer leverage_close.",
    "- lend_deposit / lend_withdraw: service lend, pool conservative|moderate|growth, amount_ui is cUSDT amount.",
    "- borrow_open: collateral in amount_ui, loan size in borrow_amount_ui, collateral_asset and borrow_asset USDT or USDC.",
    "- borrow_close: repay_amount_ui and amount_ui (collateral to unlock), repay_asset.",
    "- For questions like max loan, how much can I borrow on my positions, borrow_capacity intent — assistant_message should briefly tee up that numeric estimates follow client-side.",
    "- If the market is implied by current page context, you may omit market_reference_text.",
    "- needs_confirmation should be true for any financial action.",
    `Wallet connected: ${params.walletConnected ? "yes" : "no"}.`,
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

export function useQvacAssistant() {
  const { addresses, isConnected } = usePhantom();
  const { state } = useQvac();
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { data: currentMarket } = useKalshiMarket(ticker);
  const { data: portfolio } = useUserPortfolio();
  const { data: holdings = [] } = useOutcomeTokenHoldings(portfolio ?? undefined);
  const { rows: borrowRows } = useBorrowPanelRows(portfolio ?? undefined, holdings);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const wallet = addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address;

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
      currentMarketTicker: currentContext.current_market_ticker,
      currentMarketTitle: currentContext.current_market_title,
      openPositions: (portfolio?.positions ?? []).filter((position) => position.status === "open"),
      borrowCapacityLines,
    });

    const envelope = await qvacChatJson<AssistantEnvelope>([
      { role: "system", content: prompt },
      { role: "user", content: message },
    ]);

    let intent = toIntent(envelope);

    if (intent.type === "borrow_capacity") {
      intent = {
        ...intent,
        assistant_message: formatBorrowCapacity(borrowRows),
      };
      return { success: true, intent };
    }

    return previewIntent(intent);
  }

  async function execute(preview: QvacAssistantPreviewResult): Promise<{ navigateTo?: string; txSignature?: string; error?: string }> {
    if (!preview.command) {
      return { error: "No executable command prepared." };
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
    interpret,
    previewIntent,
    execute,
    startVoiceCapture,
    stopVoiceCapture,
  };
}
