import { useQvac } from "@/components/qvac/QvacProvider";
import type { ExecutionPlan } from "@cusp/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  const { state, setExecuting, setSuccess, setError, closeQvac } = useQvac();
  const { executionPlan, command, phase } = state;

  if (!executionPlan || phase !== "preview") return null;

  const onConfirm = () => {
    setExecuting();
    executeCommand(command, executionPlan)
      .then((txSignature) => {
        setSuccess(txSignature ?? "confirmed");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Execution failed");
      });
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) closeQvac(); }}>
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
                    {step.amount_ui.toLocaleString()} {step.asset_in} → {step.asset_out}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Exposure</span>
              <span className="text-foreground font-mono font-medium">
                {executionPlan.total_exposure_ui.toLocaleString()} USDT
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
                  {executionPlan.preview.margin_asset || "USDT"}
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
          <Button variant="ghost" onClick={closeQvac} className="w-full text-muted-foreground">
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

async function executeCommand(
  _command: unknown,
  _plan: ExecutionPlan
): Promise<string | null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("placeholder_signature"), 1500);
  });
}