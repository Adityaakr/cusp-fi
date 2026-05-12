import { useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { useQvac } from "@/components/qvac/QvacProvider";
import { useQvacAssistant } from "@/hooks/useQvacAssistant";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function QvacAssistantChat() {
  const {
    state,
    appendMessage,
    setAssistantBusy,
    setAssistantPreview,
    setExecuting,
    setSuccess,
    setError,
  } = useQvac();
  const {
    execute,
    recording,
    interpret,
    startVoiceCapture,
    stopVoiceCapture,
  } = useQvacAssistant();

  const [input, setInput] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);


  const presetPrompts = useMemo(
    () => [
      "Lend 10 USDC",
      "Borrow against my open positions",
      "What should I do with my idle balance?",
    ],
    [],
  );

  const applyPreset = (preset: string) => {
    setInput(preset);
    setAssistantPreview(null);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = preset.length;
      textarea.setSelectionRange(end, end);
    });
  };

  const isAffirmative = (message: string) =>
    /^(yes|y|yeah|yep|confirm|confirmed|go ahead|do it|continue|proceed|ok|okay|sure)$/i.test(
      message.trim()
    );

  const isNegative = (message: string) =>
    /^(no|n|cancel|stop|not now|never mind|nevermind)$/i.test(message.trim());

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || state.assistantBusy) return;

    appendMessage({ role: "user", content: message });
    setInput("");

    if (state.assistantPreview && isNegative(message)) {
      setAssistantPreview(null);
      appendMessage({
        role: "assistant",
        content: "Okay — I canceled that QVAC action. You can ask for another one anytime.",
      });
      return;
    }

    if (state.assistantPreview && isAffirmative(message)) {
      if (
        state.assistantPreview.intent.type === "borrow_open" &&
        !state.assistantPreview.command &&
        (state.assistantPreview.candidates?.length ?? 0) > 0
      ) {
        appendMessage({
          role: "assistant",
          content:
            "Pick one eligible position from the side panel first. I’ll show its max borrowable and safe borrowable amounts, then you can confirm.",
        });
        return;
      }

      setAssistantBusy(true);
      setExecuting();
      try {
        const result = await execute(state.assistantPreview);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.txSignature ?? "confirmed");
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "QVAC could not confirm that request."
        );
      } finally {
        setAssistantBusy(false);
      }
      return;
    }

    setAssistantBusy(true);
    setAssistantPreview(null);

    try {
      const preview = await interpret(message);
      if (preview.success) {
        appendMessage({
          role: "assistant",
          content: preview.intent.assistant_message,
        });
        setAssistantPreview(preview);
      } else {
        const fallback = preview.error || "I couldn't prepare that action yet.";
        appendMessage({ role: "assistant", content: fallback });
      }
    } catch (error) {
      appendMessage({
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "QVAC could not process that request.",
      });
    } finally {
      setAssistantBusy(false);
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: "end" }));
    }
  };

  const handleVoiceToggle = async () => {
    if (voiceBusy || state.assistantBusy) return;

    if (!recording) {
      try {
        await startVoiceCapture();
      } catch (error) {
        appendMessage({
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Microphone access failed.",
        });
      }
      return;
    }

    setVoiceBusy(true);
    try {
      const transcript = await stopVoiceCapture();
      const normalized = transcript.trim();
      if (!normalized) {
        appendMessage({
          role: "assistant",
          content: "I couldn't hear anything clearly. Try again or type it.",
        });
        return;
      }
      await sendMessage(normalized);
    } catch (error) {
      appendMessage({
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Voice transcription failed.",
      });
    } finally {
      setVoiceBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-bg-1/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="size-4 text-cusp-teal" aria-hidden="true" />
              QVAC · Assistant
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask in plain English to borrow, lend, trade, or route a position.
            </p>
          </div>
          <span className="inline-flex min-h-7 items-center rounded-full border border-cusp-teal/25 bg-cusp-teal/10 px-2.5 py-1 text-[11px] font-medium text-cusp-teal">
            Plain English
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        {presetPrompts.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => applyPreset(preset)}
            disabled={state.assistantBusy || voiceBusy}
            className="inline-flex min-h-9 items-center rounded-full border border-border bg-bg-2/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-cusp-teal/30 hover:bg-cusp-teal/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cusp-teal/50 disabled:opacity-50"
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-1/50">
        <ScrollArea type="always" className="h-52">
          <div className="flex min-h-full flex-col gap-2.5 px-3 py-3 pr-4">
            {state.messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-bg-2/60 px-3 py-4 text-sm text-muted-foreground">
                Start with a quick action above or type your own command below.
              </div>
            ) : (
              state.messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6",
                    message.role === "assistant"
                      ? "rounded-tl-sm bg-bg-2 text-foreground"
                      : "ml-auto rounded-tr-sm bg-cusp-teal/15 text-cusp-teal"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              ))
            )}

            {(state.assistantBusy || voiceBusy) && (
              <div className="inline-flex max-w-fit items-center gap-2 rounded-2xl rounded-tl-sm bg-bg-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {voiceBusy ? "Transcribing voice note…" : "Thinking…"}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="rounded-2xl border border-border bg-bg-1/70 p-3">
        <label htmlFor="qvac-assistant-input" className="sr-only">
          Ask QVAC
        </label>
        <div className="rounded-xl border border-border bg-bg-0 p-2">
          <Textarea
            ref={textareaRef}
            id="qvac-assistant-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Type a command or question…"
            className="min-h-[88px] resize-none border-0 bg-transparent px-1 py-1 text-sm text-foreground shadow-none focus-visible:ring-0"
            disabled={state.assistantBusy || voiceBusy}
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for a new line
            </p>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleVoiceToggle()}
                disabled={state.assistantBusy || voiceBusy}
                className={cn(
                  "size-10 shrink-0 rounded-lg",
                  recording && "border-cusp-teal bg-cusp-teal/10 text-cusp-teal hover:bg-cusp-teal/15"
                )}
                aria-label={recording ? "Stop recording" : "Start voice recording"}
              >
                {recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
              <Button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || state.assistantBusy || voiceBusy}
                className="h-10 min-w-10 shrink-0 rounded-lg bg-cusp-teal px-3 text-primary-foreground hover:bg-cusp-teal/90"
              >
                {state.assistantBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
