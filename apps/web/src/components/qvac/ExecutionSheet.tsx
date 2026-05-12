import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useQvac } from "@/components/qvac/QvacProvider";
import type { AnyQvacCommand, ExecutionPlan } from "@cusp/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useQvacAssistant } from "@/hooks/useQvacAssistant";
import type { BorrowPanelRow } from "@/hooks/useBorrowPanelRows";
import { executeQvacCommand, extractTxSignature } from "@/lib/qvac-api";

function formatAssetLabel(asset?: string) {
  if (asset === "USDT") return "USDC";
  if (asset === "cUSDT") return "cUSDC";
  return asset ?? "";
}

function StepIcon({ stepName }: { stepName: string }) {
  if (stepName.includes("deposit") || stepName.includes("lock") || stepName.includes("margin"))
    return <span className="size-6 rounded-full bg-cusp-teal/15 text-cusp-teal flex items-center justify-center text-xs">+</span>;
  if (stepName.includes("withdraw") || stepName.includes("repay") || stepName.includes("unlock") || stepName.includes("close"))
    return <span className="size-6 rounded-full bg-cusp-amber/15 text-cusp-amber flex items-center justify-center text-xs">-</span>;
  if (stepName.includes("borrow") || stepName.includes("route") || stepName.includes("execute"))
    return <span className="size-6 rounded-full bg-cusp-purple/15 text-cusp-purple flex items-center justify-center text-xs">~</span>;
  return <span className="size-6 rounded-full bg-bg-2 flex items-center justify-center text-xs text-muted-foreground">~</span>;
}

export default function ExecutionSheet() {
  const { state, setExecuting, setSuccess, setError, closeQvac, dismissSidebar, setAssistantPreview } = useQvac();
  const { execute, previewIntent, borrowRows, poolState } = useQvacAssistant();

  const { executionPlan, command, phase, assistantPreview } = state;

  const isBorrowSelector =
    phase === "preview" &&
    !!assistantPreview &&
    !executionPlan &&
    assistantPreview.intent.type === "borrow_open" &&
    (assistantPreview.candidates?.length ?? 0) > 0;

  const borrowCandidates = useMemo(
    () =>
      (assistantPreview?.candidates ?? [])
        .filter((candidate) => candidate.kind === "position")
        .map((candidate) => ({
          candidate,
          row: borrowRows.find((row) => row.id === candidate.id),
        }))
        .filter((entry): entry is { candidate: { kind: "position"; id: string; label: string; subtitle?: string }; row: BorrowPanelRow } => !!entry.row),
    [assistantPreview?.candidates, borrowRows]
  );
  const [selectedBorrowId, setSelectedBorrowId] = useState<string | null>(borrowCandidates[0]?.row.id ?? null);
  const [borrowAmount, setBorrowAmount] = useState<string>("");

  useEffect(() => {
    if (!selectedBorrowId && borrowCandidates[0]?.row.id) {
      setSelectedBorrowId(borrowCandidates[0].row.id);
    }
  }, [borrowCandidates, selectedBorrowId]);

  useEffect(() => {
    const selected = borrowRows.find((row) => row.id === selectedBorrowId) ?? borrowCandidates[0]?.row;
    if (!selected) {
      setBorrowAmount("");
      return;
    }

    const requestedAmount = assistantPreview?.intent.borrow_amount_ui ?? 0;
    if (requestedAmount > 0) {
      setBorrowAmount(String(Number(Math.min(requestedAmount, selected.maxBorrowUsd).toFixed(2))));
      return;
    }

    setBorrowAmount(String(Number(selected.safeBorrowUsd.toFixed(2))));
  }, [assistantPreview?.intent.borrow_amount_ui, borrowCandidates, borrowRows, selectedBorrowId]);

  if ((!executionPlan && !isBorrowSelector) || phase !== "preview") return null;

  const onConfirm = () => {
    if (!command) return;
    setExecuting();
    if (assistantPreview) {
      execute(assistantPreview)
        .then((result) => {
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(result.txSignature ?? "confirmed");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Execution failed");
        });
      return;
    }

    executeCommand(command, executionPlan)
      .then((txSignature) => {
        setSuccess(txSignature ?? "confirmed");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Execution failed");
      });
  };

  const onBorrowSelected = async () => {
    if (!assistantPreview || !selectedBorrowId) return;
    const selected = borrowRows.find((row) => row.id === selectedBorrowId);
    if (!selected) {
      setError("Selected position is no longer available.");
      return;
    }

    const requestedAmount = Number(borrowAmount);
    if (!(requestedAmount > 0)) {
      setError("Enter a borrow amount greater than 0.");
      return;
    }
    if (requestedAmount > selected.maxBorrowUsd) {
      setError(`Selected market supports up to $${selected.maxBorrowUsd.toFixed(2)} USDC.`);
      return;
    }
    if ((poolState?.availableLiquidity ?? 0) < requestedAmount) {
      setError(`Pool has only $${(poolState?.availableLiquidity ?? 0).toFixed(2)} USDC available.`);
      return;
    }

    setExecuting();
    try {
      const preview = await previewIntent({
        ...assistantPreview.intent,
        type: "borrow_open",
        service: "borrow",
        action: "open",
        position_reference_text: selected.id,
        market_reference_text: selected.ticker ?? selected.marketLabel,
        amount_ui: Number(selected.collateralUsd.toFixed(2)),
        borrow_amount_ui: Number(requestedAmount.toFixed(2)),
        collateral_asset: "USDC",
        borrow_asset: "USDC",
        assistant_message: `Borrowing ${requestedAmount.toFixed(2)} USDC against ${selected.marketLabel}.`,
        missing_fields: [],
      });

      setAssistantPreview(preview);
      const result = await execute(preview);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.txSignature ?? "confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Borrow failed");
    }
  };

  if (isBorrowSelector) {
    return (
      <Sheet open onOpenChange={(open) => { if (!open) dismissSidebar(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-bg-1 border-l border-border overflow-y-auto">
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-foreground">Borrow Against Open Positions</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Pick one eligible market, then set the borrow amount you want for that position.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {borrowCandidates.map(({ row }) => {
              const selected = selectedBorrowId === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedBorrowId(row.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    selected ? "border-cusp-teal bg-cusp-teal/5" : "border-border bg-bg-1 hover:bg-bg-2"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex size-5 items-center justify-center rounded-full border ${selected ? "border-cusp-teal bg-cusp-teal text-primary-foreground" : "border-border bg-bg-2"}`}>
                      {selected && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{row.marketLabel}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.side} outcome token collateral</p>
                        </div>
                        <span className="rounded-full bg-cusp-teal/10 px-2 py-1 text-[10px] font-semibold text-cusp-teal">
                          Max ${row.maxBorrowUsd.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-bg-2 px-2.5 py-2">
                          <div className="text-muted-foreground">Collateral</div>
                          <div className="font-mono text-foreground">${row.collateralUsd.toFixed(2)}</div>
                        </div>
                        <div className="rounded-lg bg-bg-2 px-2.5 py-2">
                          <div className="text-muted-foreground">Current price</div>
                          <div className="font-mono text-foreground">${row.currentPrice.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="rounded-xl border border-border bg-bg-2/60 p-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Pool liquidity</span>
                <span className="font-mono text-foreground">${(poolState?.availableLiquidity ?? 0).toFixed(2)} USDC</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Selection mode</span>
                <span className="font-mono text-foreground">One market at a time</span>
              </div>
            </div>

            {selectedBorrowId && (() => {
              const selected = borrowRows.find((row) => row.id === selectedBorrowId);
              if (!selected) return null;

              const requestedAmount = Number(borrowAmount) || 0;
              const exceedsPositionMax = requestedAmount > selected.maxBorrowUsd;
              const exceedsPoolLiquidity = requestedAmount > (poolState?.availableLiquidity ?? 0);

              return (
                <div className="rounded-xl border border-border bg-bg-1 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Borrow amount</p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBorrowAmount(selected.safeBorrowUsd.toFixed(2))}
                        className="rounded-full border border-border px-2 py-1 text-cusp-green hover:border-cusp-green/40"
                      >
                        Safe ${selected.safeBorrowUsd.toFixed(2)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBorrowAmount(selected.maxBorrowUsd.toFixed(2))}
                        className="rounded-full border border-border px-2 py-1 text-cusp-amber hover:border-cusp-amber/40"
                      >
                        Max ${selected.maxBorrowUsd.toFixed(2)}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={borrowAmount}
                      onChange={(event) => setBorrowAmount(event.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-border bg-bg-0 px-4 py-3 pr-16 text-sm font-mono text-foreground outline-none transition-colors focus:border-cusp-teal focus:ring-2 focus:ring-cusp-teal/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                      USDC
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-bg-2 px-3 py-2">
                      <div className="text-muted-foreground">Requested</div>
                      <div className="font-mono text-foreground">${requestedAmount.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-bg-2 px-3 py-2">
                      <div className="text-muted-foreground">Position max</div>
                      <div className="font-mono text-foreground">${selected.maxBorrowUsd.toFixed(2)}</div>
                    </div>
                  </div>

                  {(exceedsPositionMax || exceedsPoolLiquidity) && (
                    <div className="rounded-lg border border-cusp-amber/20 bg-cusp-amber/8 px-3 py-2 text-xs text-cusp-amber">
                      {exceedsPositionMax
                        ? "Requested amount is above this position’s max borrow."
                        : `Pool liquidity is capped at $${(poolState?.availableLiquidity ?? 0).toFixed(2)} USDC right now.`}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <SheetFooter className="mt-8 flex-col gap-2">
            <Button
              onClick={() => void onBorrowSelected()}
              disabled={!selectedBorrowId || !(Number(borrowAmount) > 0)}
              className="w-full bg-cusp-teal text-primary-foreground hover:bg-cusp-teal/90 font-medium"
            >
              Review and borrow selected amount
            </Button>
            <Button variant="ghost" onClick={dismissSidebar} className="w-full text-muted-foreground">
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) dismissSidebar(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-bg-1 border-l border-border overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-foreground">Execution Plan</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Review the steps before confirming
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {executionPlan.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <StepIcon stepName={step.step} />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.description}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {step.amount_ui.toLocaleString()} {formatAssetLabel(step.asset_in)} → {formatAssetLabel(step.asset_out)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-cusp-teal/20 bg-cusp-teal/5 px-4 py-3 text-sm text-foreground">
            Confirming will open your wallet to sign the USDC deposit transaction.
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Exposure</span>
              <span className="text-foreground font-mono font-medium">
                {executionPlan.total_exposure_ui.toLocaleString()} USDC
              </span>
            </div>
            {executionPlan.preview.execution_route !== "internal" && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Route</span>
                <span className="text-foreground font-mono">{executionPlan.preview.execution_route}</span>
              </div>
            )}
            {executionPlan.preview.borrowed_amount_ui > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Borrowed</span>
                <span className="text-foreground font-mono">
                  {executionPlan.preview.borrowed_amount_ui.toLocaleString()}{" "}
                  {formatAssetLabel(executionPlan.preview.margin_asset || "USDC")}
                </span>
              </div>
            )}
            {executionPlan.preview.max_slippage_bps > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Slippage</span>
                <span className="text-foreground font-mono">
                  {(executionPlan.preview.max_slippage_bps / 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="mt-8 flex-col gap-2">
          <Button
            onClick={onConfirm}
            className="w-full bg-cusp-teal text-primary-foreground hover:bg-cusp-teal/90 font-medium"
          >
            Confirm Transaction
          </Button>
          <Button variant="ghost" onClick={dismissSidebar} className="w-full text-muted-foreground">
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

async function executeCommand(
  command: AnyQvacCommand,
  _plan: ExecutionPlan
): Promise<string | null> {
  const result = await executeQvacCommand(command);
  return extractTxSignature(result.data) ?? null;
}
