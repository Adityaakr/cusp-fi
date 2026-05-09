import { useQvac } from "@/components/qvac/QvacProvider";
import { getMarketDisplayValue } from "@/components/qvac/qvacFlows";
import QvacStepInput from "@/components/qvac/QvacStepInput";
import { usePhantom } from "@/lib/wallet";
import { previewQvacCommand } from "@/lib/qvac-api";
import { useState } from "react";

export default function QvacChat() {
  const { state, setStepValue, nextStep, prevStep, submitForPreview, setExecutionPlan, setError } = useQvac();
  const { addresses } = usePhantom();
  const [submitting, setSubmitting] = useState(false);
  const { flow, stepIndex, stepValues } = state;

  if (!flow) return null;

  const isWizard = state.phase === "wizard";
  const steps = flow.steps;
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const currentStepValue = currentStep ? stepValues[currentStep.key] : undefined;

  const isCurrentStepValid = (): boolean => {
    if (!currentStep) return false;
    if (currentStep.validation) {
      return currentStep.validation(currentStepValue) === null;
    }
    if (currentStep.type === "amount") {
      const n = Number(currentStepValue);
      return Number.isFinite(n) && n > 0;
    }
    if (currentStep.type === "select" || currentStep.type === "market_search") {
      return !!currentStepValue;
    }
    return currentStepValue !== undefined && currentStepValue !== "";
  };

  const allStepsFilled = steps.every((s) => stepValues[s.key] !== undefined && stepValues[s.key] !== "");

  const wallet =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address ??
    addresses?.[0]?.address ??
    "";

  const handleSubmit = async () => {
    if (!flow || !allStepsFilled) return;
    if (!wallet) {
      setError("Connect your wallet to prepare a QVAC action.");
      return;
    }

    const command = flow.buildCommand(stepValues, wallet);
    setSubmitting(true);

    try {
      const result = await previewQvacCommand(command);
      if (!result.success || !result.execution_plan) {
        setError(result.error || "Unable to prepare the execution plan.");
        return;
      }

      setExecutionPlan(result.execution_plan as typeof state.executionPlan);
      submitForPreview(command);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to prepare the execution plan."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isWizard) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-border bg-bg-2 px-4 py-4">
          <p className="text-sm font-medium text-foreground">Preview ready</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the execution plan on the right, then confirm to submit the {flow.label.toLowerCase()} action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isWizard && (
        <div className="flex items-center gap-1.5 justify-center">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-colors ${
                i < stepIndex
                  ? "bg-cusp-teal w-4"
                  : i === stepIndex
                    ? "bg-cusp-teal w-6"
                    : "bg-border w-4"
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {stepIndex > 0 && (
          <button
            onClick={prevStep}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {currentStep && isWizard && (
          <div className="bg-bg-2 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-foreground">{currentStep.question}</p>
          </div>
        )}

        {isWizard && currentStep && (
          <QvacStepInput
            step={currentStep}
            value={currentStepValue}
            onChange={(value) => setStepValue(currentStep.key, value)}
            onSubmit={isLastStep && allStepsFilled ? () => void handleSubmit() : nextStep}
            isValid={isCurrentStepValid()}
          />
        )}

        {isWizard && currentStepValue && isWizard && (
          <div className="bg-cusp-teal/15 text-cusp-teal rounded-2xl rounded-tr-sm px-4 py-2.5 self-end max-w-[85%]">
            <p className="text-sm">
              {currentStep.type === "amount"
                ? `${Number(currentStepValue).toLocaleString()} ${currentStep.asset || ""}`
                : currentStep.type === "market_search"
                  ? getMarketDisplayValue(currentStepValue)
                : (currentStep.options?.find((o) => o.value === currentStepValue)?.label ?? String(currentStepValue))}
            </p>
          </div>
        )}
      </div>

      {isWizard && isLastStep && allStepsFilled && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-cusp-teal text-primary-foreground font-medium py-2.5 rounded-lg hover:bg-cusp-teal/90 transition-colors text-sm"
        >
          {submitting ? "Preparing preview…" : "Review & Confirm"}
        </button>
      )}
    </div>
  );
}
