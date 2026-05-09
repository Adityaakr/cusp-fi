import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import type { AnyQvacCommand, ExecutionPlan } from "@cusp/shared";
import type { QvacFlow } from "@/components/qvac/qvacFlows";

export type QvacPhase =
  | "closed"
  | "selecting"
  | "wizard"
  | "preview"
  | "executing"
  | "success"
  | "error";

interface QvacState {
  phase: QvacPhase;
  flow: QvacFlow | null;
  stepIndex: number;
  stepValues: Record<string, unknown>;
  command: AnyQvacCommand | null;
  executionPlan: ExecutionPlan | null;
  error: string | null;
  txSignature: string | null;
}

interface QvacContextValue {
  state: QvacState;
  openQvac: () => void;
  closeQvac: () => void;
  selectFlow: (flow: QvacFlow) => void;
  setStepValue: (key: string, value: unknown) => void;
  nextStep: () => void;
  prevStep: () => void;
  submitForPreview: (command: AnyQvacCommand) => void;
  setExecutionPlan: (plan: ExecutionPlan) => void;
  setExecuting: () => void;
  setSuccess: (txSignature: string) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const initialState: QvacState = {
  phase: "closed",
  flow: null,
  stepIndex: 0,
  stepValues: {},
  command: null,
  executionPlan: null,
  error: null,
  txSignature: null,
};

const QvacContext = createContext<QvacContextValue | null>(null);

export function QvacProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QvacState>(initialState);

  const openQvac = useCallback(() => {
    setState({ ...initialState, phase: "selecting" });
  }, []);

  const closeQvac = useCallback(() => {
    setState(initialState);
  }, []);

  const selectFlow = useCallback((flow: QvacFlow) => {
    setState({ ...initialState, phase: "wizard", flow, stepIndex: 0, stepValues: {} });
  }, []);

  const setStepValue = useCallback((key: string, value: unknown) => {
    setState((prev) => ({
      ...prev,
      stepValues: { ...prev.stepValues, [key]: value },
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (!prev.flow) return prev;
      const nextIdx = prev.stepIndex + 1;
      if (nextIdx >= prev.flow.steps.length) return prev;
      return { ...prev, stepIndex: nextIdx };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => {
      if (prev.stepIndex <= 0) return prev;
      return { ...prev, stepIndex: prev.stepIndex - 1 };
    });
  }, []);

  const submitForPreview = useCallback((command: AnyQvacCommand) => {
    setState((prev) => ({ ...prev, command, phase: "preview" as QvacPhase }));
  }, []);

  const setExecutionPlan = useCallback((plan: ExecutionPlan) => {
    setState((prev) => ({ ...prev, executionPlan: plan }));
  }, []);

  const setExecuting = useCallback(() => {
    setState((prev) => ({ ...prev, phase: "executing" }));
  }, []);

  const setSuccess = useCallback((txSignature: string) => {
    setState((prev) => ({ ...prev, phase: "success", txSignature }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, phase: "error", error }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <QvacContext.Provider
      value={{
        state,
        openQvac,
        closeQvac,
        selectFlow,
        setStepValue,
        nextStep,
        prevStep,
        submitForPreview,
        setExecutionPlan,
        setExecuting,
        setSuccess,
        setError,
        reset,
      }}
    >
      {children}
    </QvacContext.Provider>
  );
}

export function useQvac() {
  const ctx = useContext(QvacContext);
  if (!ctx) throw new Error("useQvac must be used within QvacProvider");
  return ctx;
}