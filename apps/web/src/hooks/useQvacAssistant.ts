import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AnyQvacCommand, QvacAssistantIntent, QvacAssistantPreviewResult } from "@cusp/shared";
import { usePhantom } from "@/lib/wallet";
import { checkQvacAvailability, qvacChatJson, qvacTranscribe } from "@/lib/qvac-local";
import { useKalshiMarket } from "@/hooks/useKalshiMarkets";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
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
  confidence?: number;
  needs_confirmation?: boolean;
  missing_fields?: string[];
}

function buildPrompt(params: {
  walletConnected: boolean;
  currentMarketTicker?: string;
  currentMarketTitle?: string;
  openPositions: Array<{ market_ticker: string; market_title?: string; side: string; position_type: string }>;
}) {
  return [
    "You are CUSP's local trading copilot.",
    "Return JSON only. No markdown.",
    "Interpret the user's request into a single object with keys:",
    "assistant_message, intent, service, action, market_reference_text, position_reference_text, side, amount_ui, leverage, confidence, needs_confirmation, missing_fields.",
    "Allowed intent values: direct_trade, leverage_open, leverage_close, market_search, position_summary, risk_explain, unknown.",
    "Rules:",
    "- Never execute anything.",
    "- If user wants to buy or trade on a market, prefer direct_trade unless leverage is explicit.",
    "- If user asks to close a position, prefer leverage_close.",
    "- If the market is implied by current page context, you may omit market_reference_text.",
    "- needs_confirmation should be true for any financial action.",
    `Wallet connected: ${params.walletConnected ? "yes" : "no"}.`,
    params.currentMarketTicker
      ? `Current market context: ${params.currentMarketTitle ?? params.currentMarketTicker} (${params.currentMarketTicker}).`
      : "Current market context: none.",
    `Open positions: ${params.openPositions.length ? params.openPositions.map((p) => `${p.market_title ?? p.market_ticker} ${p.side} ${p.position_type}`).join("; ") : "none"}.`,
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
    confidence: envelope.confidence ?? 0.7,
    needs_confirmation: envelope.needs_confirmation ?? ["direct_trade", "leverage_open", "leverage_close"].includes(type),
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
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const wallet = addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address;

  const currentContext = useMemo(
    () => ({
      current_market_ticker: state.assistantContext?.current_market_ticker ?? currentMarket?.ticker,
      current_market_title: state.assistantContext?.current_market_title ?? currentMarket?.name,
      position_id: state.assistantContext?.position_id,
    }),
    [currentMarket?.ticker, currentMarket?.name, state.assistantContext]
  );

  async function previewIntent(intent: QvacAssistantIntent): Promise<QvacAssistantPreviewResult> {
    const previewRes = await fetch("/api/qvac/assistant/preview", {
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

    const preview = await previewRes.json() as QvacAssistantPreviewResult;
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
    });

    const envelope = await qvacChatJson<AssistantEnvelope>([
      { role: "system", content: prompt },
      { role: "user", content: message },
    ]);

    const intent = toIntent(envelope);

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
        const rounded = preview.intent.leverage && preview.intent.leverage >= 2.5 ? 3 : preview.intent.leverage && preview.intent.leverage >= 1.5 ? 2 : 1;
        params.set("leverage", String(rounded));
      }
      const href = `/markets/${command.market_query}?${params.toString()}`;
      navigate(href);
      return { navigateTo: href };
    }

    const res = await fetch("/api/qvac/assistant/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: preview.intent,
        command: preview.command,
      }),
    });
    const data = await res.json() as { success: boolean; data?: { tx_signature?: string }; error?: string };
    if (!data.success) return { error: data.error || "Execution failed" };
    return { txSignature: data.data?.tx_signature };
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
