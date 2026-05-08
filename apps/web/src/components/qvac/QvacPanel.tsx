import { useEffect, useCallback } from "react";
import { X, Sparkles } from "lucide-react";
import { useQvac, type QvacPhase } from "@/components/qvac/QvacProvider";
import QvacCommandList from "@/components/qvac/QvacCommandList";
import QvacChat from "@/components/qvac/QvacChat";
import ExecutionSheet from "@/components/qvac/ExecutionSheet";

export default function QvacPanel() {
  const { state, closeQvac, reset, openQvac, setAssistantContext } = useQvac();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (state.phase === "closed") {
          const openQvacEvent = new CustomEvent("qvac:open");
          window.dispatchEvent(openQvacEvent);
        } else {
          closeQvac();
        }
      }
      if (e.key === "Escape" && state.phase !== "closed") {
        closeQvac();
      }
    };
    const openHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setAssistantContext(customEvent.detail);
      }
      openQvac();
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("qvac:open", openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("qvac:open", openHandler);
    };
  }, [state.phase, closeQvac, openQvac, setAssistantContext]);

  const handleBackdropClick = useCallback(() => {
    closeQvac();
  }, [closeQvac]);

  if (state.phase === "closed") return null;

  if (state.phase === "selecting") {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleBackdropClick} />
        <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2">
          <div className="rounded-2xl border border-border bg-bg-1 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="size-4 text-cusp-teal" />
                QVAC
              </div>
              <button
                onClick={closeQvac}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-bg-2 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4">
              <QvacCommandList />
            </div>
            <div className="border-t border-border px-4 py-2">
              <p className="text-[11px] text-muted-foreground text-center">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-bg-2 text-[10px] font-mono">esc</kbd>{" "}
                to close
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (state.phase === "wizard" || state.phase === "preview") {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleBackdropClick} />
        <div className="fixed left-1/2 top-[10%] z-50 w-full max-w-md -translate-x-1/2 max-h-[80vh] flex flex-col">
          <div className="rounded-2xl border border-border bg-bg-1 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="size-4 text-cusp-teal" />
                {state.flow?.label ?? "QVAC"}
              </div>
              <button
                onClick={closeQvac}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-bg-2 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <QvacChat />
            </div>
          </div>
        </div>
        {state.phase === "preview" && state.executionPlan && (
          <ExecutionSheet />
        )}
      </>
    );
  }

  if (state.phase === "executing" || state.phase === "success" || state.phase === "error") {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleBackdropClick} />
        <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-sm -translate-x-1/2">
          <div className="rounded-2xl border border-border bg-bg-1 shadow-2xl p-6 text-center">
            <StatusDisplay phase={state.phase} error={state.error} txSignature={state.txSignature} />
            <div className="mt-4 flex justify-center gap-3">
              {(state.phase === "success" || state.phase === "error") && (
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-cusp-teal text-primary-foreground hover:bg-cusp-teal/90 transition-colors"
                >
                  New Command
                </button>
              )}
              <button
                onClick={closeQvac}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-bg-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}

function StatusDisplay({
  phase,
  error,
  txSignature,
}: {
  phase: QvacPhase;
  error: string | null;
  txSignature: string | null;
}) {
  if (phase === "executing") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-2 border-cusp-teal border-t-transparent" />
        <p className="text-sm text-foreground">Processing transaction...</p>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-full bg-cusp-teal/15 flex items-center justify-center">
          <svg className="size-5 text-cusp-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">Transaction confirmed</p>
        {txSignature && (
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cusp-teal hover:underline"
          >
            View on Solscan
          </a>
        )}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-full bg-destructive/15 flex items-center justify-center">
          <svg className="size-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">Transaction failed</p>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>
    );
  }

  return null;
}
