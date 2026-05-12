import Layout from "@/components/Layout";
import { hasInviteAccess, isInviteGateBypassed, setInviteCode } from "@/lib/access";
import { motion } from "framer-motion";
import { FormEvent, ReactNode, useEffect, useState } from "react";

interface AccessGateProps {
  children: ReactNode;
}

const AccessGate = ({ children }: AccessGateProps) => {
  const bypass = isInviteGateBypassed();
  const [status, setStatus] = useState<"checking" | "locked" | "unlocked">(
    bypass ? "unlocked" : "checking",
  );
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (bypass) return;
    let cancelled = false;
    hasInviteAccess().then((ok) => {
      if (!cancelled) setStatus(ok ? "unlocked" : "locked");
    });
    return () => {
      cancelled = true;
    };
  }, [bypass]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const ok = await setInviteCode(inviteInput);
    setSubmitting(false);

    if (ok) {
      setInviteInput("");
      setStatus("unlocked");
      return;
    }

    setError("Invalid invite code. Please try again.");
  };

  if (status === "unlocked") return <>{children}</>;

  return (
    <Layout>
      <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center justify-center overflow-hidden px-4 py-16 sm:px-6">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(40,204,149,0.13),rgba(0,0,0,0)_38%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(40,204,149,0.09),rgba(0,0,0,0.92)_34%,rgba(0,0,0,1)_100%)]" />
          <motion.div
            className="absolute left-1/2 top-[58%] h-px w-[34rem] -translate-x-1/2 bg-[#28cc95]/25"
            animate={{ opacity: [0.15, 0.45, 0.15], scaleX: [0.9, 1, 0.9] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[25rem] font-['Satoshi','DM_Sans',sans-serif]"
        >
          <div className="absolute -inset-px rounded-xl bg-[#28cc95]/35 shadow-[0_0_52px_rgba(40,204,149,0.14)]" />
          <div className="relative rounded-xl border border-[#28cc95]/30 bg-[linear-gradient(145deg,rgba(8,18,15,0.98),rgba(0,0,0,0.98)_58%,rgba(3,10,8,0.98))] p-5 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#28cc95]/35 bg-black/45 px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.22em] text-[#28cc95]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#28cc95]" />
                Private Access
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#28cc95] shadow-[0_0_22px_rgba(40,204,149,0.22)]">
                <img src="/cusp.png" alt="" className="h-6 w-6 rounded-full" />
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Access Cusp</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Enter your private beta invite to continue.
            </p>

            {status === "checking" ? (
              <div className="mt-6 rounded-lg border border-[#28cc95]/25 bg-black/45 p-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-[#28cc95]"
                    animate={{ x: ["-120%", "320%"] }}
                    transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Checking access...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(event) => {
                    setInviteInput(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Invite code"
                  autoFocus
                  className="w-full rounded-lg border border-white/12 bg-black/55 px-4 py-3 font-mono text-sm text-foreground shadow-inner shadow-black/50 transition-colors placeholder:font-body placeholder:text-muted-foreground focus:border-[#28cc95]/80 focus:outline-none focus:ring-2 focus:ring-[#28cc95]/20"
                />
                {error && <p className="text-xs font-medium text-[#ff5b5b]">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || inviteInput.trim().length === 0}
                  className="w-full rounded-lg border border-[#28cc95] bg-[#28cc95] px-4 py-3 text-sm font-semibold text-black shadow-[0_14px_32px_rgba(40,204,149,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#30d7a0] disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-[#28cc95]/35 disabled:bg-[#28cc95]/35 disabled:text-black/70"
                >
                  {submitting ? "Verifying..." : "Enter platform"}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default AccessGate;
