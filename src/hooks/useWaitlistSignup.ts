import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

export const WAITLIST_DISPLAY_OFFSET = 100;

export function getWaitlistErrorMessage(code?: string) {
  if (code === "23505") return "This email is already registered.";
  return "Something went wrong. Please try again.";
}

export function useWaitlistSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
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

  const submit = useCallback(async () => {
    if (!email.trim()) return false;

    setStatus("loading");
    setError("");

    if (!supabase) {
      setStatus("error");
      setError("Waitlist is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
      return false;
    }

    const { error: insertError } = await supabase
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase() });

    if (insertError) {
      setStatus("error");
      setError(getWaitlistErrorMessage(insertError.code));
      return false;
    }

    setStatus("success");
    setEmail("");
    setCount((current) => (current !== null ? current + 1 : 1));
    void refreshCount();
    return true;
  }, [email, refreshCount]);

  const displayCount = useMemo(
    () => (count !== null ? count + WAITLIST_DISPLAY_OFFSET : 0),
    [count],
  );

  return {
    count,
    countLoading,
    displayCount,
    email,
    error,
    refreshCount,
    setEmail,
    status,
    submit,
  };
}

export type WaitlistSignupState = ReturnType<typeof useWaitlistSignup>;
