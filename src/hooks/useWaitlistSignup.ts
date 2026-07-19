import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

export const WAITLIST_DISPLAY_OFFSET = 100;

// Result of a submit attempt. The page maps these to user-facing copy.
export type WaitlistSubmitResult = "success" | "duplicate" | "invalid" | "error";
export type WaitlistErrorKind = "duplicate" | "invalid" | "server" | null;

// Pragmatic RFC-5321-ish check: something@something.tld with no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

// Retained for legacy consumers (WaitlistCapture, unit tests). Prefer `errorKind`.
export function getWaitlistErrorMessage(code?: string) {
  if (code === "23505") return "This email is already registered.";
  return "Something went wrong. Please try again.";
}

function messageForKind(kind: WaitlistErrorKind) {
  if (kind === "duplicate") return "This email is already registered.";
  if (kind === "invalid") return "Enter a valid email address.";
  if (kind === "server") return "Something went wrong. Please try again.";
  return "";
}

export function useWaitlistSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorKind, setErrorKind] = useState<WaitlistErrorKind>(null);
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);

  const refreshCount = useCallback(async () => {
    if (!supabase) {
      setCountLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("get_waitlist_count");
    if (!rpcError && data !== null) setCount(Number(data));
    setCountLoading(false);
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  const submit = useCallback(async (): Promise<WaitlistSubmitResult> => {
    const trimmed = email.trim().toLowerCase();

    // Client-side validation: empty or malformed -> inline validation, no request.
    if (!isValidEmail(trimmed)) {
      setStatus("error");
      setErrorKind("invalid");
      return "invalid";
    }

    setStatus("loading");
    setErrorKind(null);

    // Backend not reachable / misconfigured -> genuine server failure.
    if (!supabase) {
      setStatus("error");
      setErrorKind("server");
      return "error";
    }

    const { error: insertError } = await supabase.from("waitlist").insert({ email: trimmed });

    if (insertError) {
      // 23505 = unique_violation -> email already registered.
      if (insertError.code === "23505") {
        setStatus("error");
        setErrorKind("duplicate");
        return "duplicate";
      }
      // Anything else (missing table PGRST205, RLS, 5xx, network) is a real
      // server failure. Surface it — do not pretend the signup succeeded.
      setStatus("error");
      setErrorKind("server");
      return "error";
    }

    setStatus("success");
    setEmail("");
    setCount((current) => (current !== null ? current + 1 : 1));
    void refreshCount();
    return "success";
  }, [email, refreshCount]);

  const displayCount = useMemo(
    () => (count !== null ? count + WAITLIST_DISPLAY_OFFSET : 0),
    [count],
  );

  // Legacy string message, derived from errorKind, for older consumers.
  const error = useMemo(() => messageForKind(errorKind), [errorKind]);

  return {
    count,
    countLoading,
    displayCount,
    email,
    error,
    errorKind,
    refreshCount,
    setEmail,
    status,
    submit,
  };
}

export type WaitlistSignupState = ReturnType<typeof useWaitlistSignup>;
