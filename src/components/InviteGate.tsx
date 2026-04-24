import { useState } from "react";
import { useModal } from "@phantom/react-sdk";
import Layout from "@/components/Layout";
import { useInviteAccess } from "@/hooks/useInviteAccess";

interface InviteGateProps {
  children: React.ReactNode;
}

const InviteGate = ({ children }: InviteGateProps) => {
  const { hasAccess, isLoading, isConnected, verifyCode } = useInviteAccess();
  const { open } = useModal();
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </Layout>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 sm:px-6 py-16">
          <div className="bg-bg-1 border border-border rounded-lg p-6">
            <h1 className="text-lg font-semibold text-foreground mb-1">
              Connect Wallet
            </h1>
            <p className="text-sm text-muted-foreground mb-5">
              Connect your wallet to access Cusp. The app is currently in
              private beta.
            </p>
            <button
              onClick={() => open()}
              className="w-full bg-cusp-teal text-bg-0 rounded-md px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await verifyCode(inviteInput);
    if (!result.ok) {
      setError(result.error ?? "Invalid invite code.");
    } else {
      setInviteInput("");
    }
    setSubmitting(false);
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-16">
        <div className="bg-bg-1 border border-border rounded-lg p-6">
          <h1 className="text-lg font-semibold text-foreground mb-1">
            Invite-only access
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            Cusp is currently in private beta. Enter your invite code to
            continue.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => {
                setInviteInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Invite code"
              autoFocus
              className="w-full bg-bg-2 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors"
            />
            {error && <p className="text-xs text-cusp-red">{error}</p>}
            <button
              type="submit"
              disabled={inviteInput.trim().length === 0 || submitting}
              className="w-full bg-cusp-teal text-bg-0 rounded-md px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Verifying..." : "Unlock Access"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default InviteGate;
