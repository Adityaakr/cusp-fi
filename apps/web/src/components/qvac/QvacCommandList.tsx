import { useMemo, useState } from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";
import { QVAC_FLOWS } from "@/components/qvac/qvacFlows";
import { useQvac } from "@/components/qvac/QvacProvider";
import { useQvacContext } from "@/hooks/useQvacContext";
import { useQvacAssistant } from "@/hooks/useQvacAssistant";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import QvacSuggestions from "@/components/qvac/QvacSuggestions";

export default function QvacCommandList() {
  const {
    selectFlow,
    appendMessage,
    setAssistantBusy,
    setAssistantPreview,
    state,
  } = useQvac();
  const { suggestions, contextLabel } = useQvacContext();
  const { interpret, previewIntent, recording, startVoiceCapture, stopVoiceCapture } = useQvacAssistant();
  const [input, setInput] = useState("");

  const grouped = useMemo(
    () =>
      QVAC_FLOWS.reduce<Record<string, typeof QVAC_FLOWS>>((acc, flow) => {
        if (!acc[flow.category]) acc[flow.category] = [];
        acc[flow.category].push(flow);
        return acc;
      }, {}),
    []
  );

  const submit = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setInput("");
    appendMessage({ role: "user", content: trimmed });
    setAssistantBusy(true);
    setAssistantPreview(null);
    try {
      const preview = await interpret(trimmed);
      appendMessage({
        role: "assistant",
        content: preview.intent?.assistant_message || preview.error || "I've prepared that.",
      });
      if (preview.execution_plan || preview.candidates?.length || preview.error) {
        setAssistantPreview(preview);
      }
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: error instanceof Error ? error.message : "QVAC failed to interpret that request.",
      });
    } finally {
      setAssistantBusy(false);
    }
  };

  const toggleVoice = async () => {
    if (!recording) {
      await startVoiceCapture();
      return;
    }
    const transcript = await stopVoiceCapture();
    if (transcript.trim()) {
      await submit(transcript);
    }
  };

  const chooseCandidate = async (candidate: NonNullable<typeof state.assistantPreview>["candidates"][number]) => {
    const preview = state.assistantPreview;
    if (!preview?.intent) return;
    setAssistantBusy(true);
    try {
      const nextIntent = candidate.kind === "position"
        ? {
            ...preview.intent,
            resolved_position_id: candidate.id,
            position_reference_text: candidate.label,
          }
        : {
            ...preview.intent,
            resolved_market_ticker: candidate.id,
            resolved_market_title: candidate.label,
            market_reference_text: candidate.label,
          };
      const nextPreview = await previewIntent(nextIntent);
      appendMessage({
        role: "assistant",
        content: nextPreview.intent?.assistant_message || nextPreview.error || "Updated the preview.",
      });
      setAssistantPreview(nextPreview);
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: error instanceof Error ? error.message : "Unable to refine that selection.",
      });
    } finally {
      setAssistantBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-cusp-teal/20 bg-cusp-teal/5 p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-cusp-teal" />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Ask CUSP</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Try: “find cricket markets”, “buy yes on this market for 50”, or “close my position”.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            placeholder="Type what you want to do..."
            className="h-10 flex-1 rounded-lg border border-border bg-bg-0 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/40"
          />
          <button
            type="button"
            onClick={() => void toggleVoice()}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
              recording
                ? "border-cusp-teal bg-cusp-teal/15 text-cusp-teal"
                : "border-border bg-bg-0 text-muted-foreground hover:text-foreground"
            }`}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={!input.trim() || state.assistantBusy}
            className="h-10 rounded-lg bg-cusp-teal px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>

        {state.messages.length > 0 && (
          <div className="mt-3 flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
            {state.messages.slice(-6).map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "self-end rounded-tr-sm bg-cusp-teal/15 text-cusp-teal"
                    : "rounded-tl-sm bg-bg-0 text-foreground"
                }`}
              >
                {message.content}
              </div>
            ))}
            {state.assistantBusy && (
              <div className="rounded-2xl rounded-tl-sm bg-bg-0 px-3 py-2 text-sm text-muted-foreground">
                Thinking…
              </div>
            )}
            {state.assistantPreview?.candidates?.length ? (
              <div className="flex flex-wrap gap-2">
                {state.assistantPreview.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => void chooseCandidate(candidate)}
                    className="rounded-full border border-border bg-bg-0 px-3 py-1.5 text-xs text-foreground hover:border-cusp-teal/40"
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <QvacSuggestions suggestions={suggestions} contextLabel={contextLabel} onSelect={selectFlow} />
      <Command className="rounded-xl border border-border bg-bg-1">
        <CommandInput placeholder="Browse manual actions..." className="text-foreground" />
        <CommandList className="max-h-[240px]">
          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
            No commands found.
          </CommandEmpty>
          {Object.entries(grouped).map(([category, flows]) => (
            <CommandGroup key={category} heading={category} className="text-muted-foreground">
              {flows.map((flow) => {
                const Icon = flow.icon;
                return (
                  <CommandItem
                    key={flow.id}
                    value={`${flow.label} ${flow.category} ${flow.id}`}
                    onSelect={() => selectFlow(flow)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground cursor-pointer data-[selected=true]:bg-cusp-teal/10 data-[selected=true]:text-cusp-teal"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{flow.label}</span>
                      <span className="text-xs text-muted-foreground">{flow.description}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
