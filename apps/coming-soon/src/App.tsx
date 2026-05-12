import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

function App() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);

  const DISPLAY_OFFSET = 100;
  const displayCount = count !== null ? count + DISPLAY_OFFSET : 0;

  const fetchCount = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("get_waitlist_count");
    if (!error && data !== null) setCount(Number(data));
    setCountLoading(false);
  };

  // Fetch live waitlist count
  useEffect(() => {
    if (!supabase) {
      setCountLoading(false);
      return;
    }
    void fetchCount();
    const interval = setInterval(fetchCount, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    if (!supabase) {
      setStatus("error");
      setErrorMessage("Waitlist is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }

    const { error } = await supabase.from("waitlist").insert({ email: email.trim().toLowerCase() });

    if (error) {
      setStatus("error");
      if (error.code === "23505") {
        setErrorMessage("This email is already registered.");
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
      return;
    }

    setStatus("success");
    setEmail("");
    setCount((c) => (c !== null ? c + 1 : 1)); // Real count +1; display = real + 100
    void fetchCount(); // Refetch from Supabase to stay in sync
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <a href="/" className="logo">
            <img src="/cusp.png" alt="Cusp" className="logo-img" />
            <span className="logo-text">Cusp</span>
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <h1 className="hero-title">
            Your prediction market positions shouldn't sit idle.
          </h1>
          <p className="hero-subtitle">
            <strong>CUSP is the Capital Layer for Prediction Markets.</strong> CUSP is building the capital layer for prediction markets starting with CUSP Yield, a private alpha for making prediction market capital more productive next Cusp Credit & Index.
          </p>
          <div className="hero-ctas">
            <a href="#waitlist" className="hero-cta-primary">
              Join Waitlist
            </a>
            <a
              href="https://x.com/usecusp"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta-secondary"
            >
              Follow on X
            </a>
          </div>
        </div>
      </section>

      <section className="why-cusp">
        <div className="why-cusp-inner">
          <h2 className="why-cusp-title">Why CUSP</h2>
          <p className="why-cusp-desc">
            Prediction market capital is growing, but most positions still sit idle until resolution.
            CUSP is building the capital layer for this market — starting with yield, then Credit, Index then unified portfolio infrastructure.
          </p>
        </div>
      </section>

      <section className="waitlist" id="waitlist">
        <div className="waitlist-inner">
          <div className="waitlist-count-card">
            {countLoading ? (
              <span className="waitlist-count-loading">Loading…</span>
            ) : (
              <>
                <span className="waitlist-count-num">{displayCount.toLocaleString()}</span>
                <span className="waitlist-count-label">
                  people on the waitlist for CUSP Alpha
                </span>
                <span className="waitlist-count-live" aria-hidden>●</span>
              </>
            )}
          </div>
          <h2 className="waitlist-title">Join the waitlist</h2>
          <p className="waitlist-desc">Early access for private alpha. We'll reach out when you're in.</p>

          {status === "success" ? (
            <div className="form-success">
              <p className="form-success-text">Successfully registered.</p>
              <p className="form-success-sub">We'll be in touch.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="waitlist-form">
              <div className="form-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="form-input"
                  disabled={status === "loading"}
                />
                <button type="submit" className="form-submit" disabled={status === "loading"}>
                  {status === "loading" ? "Joining…" : "Join"}
                </button>
              </div>
              {status === "error" && (
                <p className="form-message error">{errorMessage}</p>
              )}
            </form>
          )}
        </div>
      </section>

      <section className="phases">
        <div className="phases-inner">
          <h2 className="phases-title">Coming next</h2>
          <div className="phase-cards">
            <article className="phase-card">
              <span className="phase-label">Phase 1 — CUSP Yield</span>
              <p className="phase-desc">
                Private alpha for making prediction market capital more productive. Start with managed yield for idle prediction-market-linked capital. Credit and unified capital tooling come next.
              </p>
            </article>
            <article className="phase-card">
              <span className="phase-label">Phase 2 — CUSP Credit</span>
              <p className="phase-desc">
                Coming soon. Borrow USDC against your YES/NO outcome tokens without closing them. Dynamic LTV based on probability and time to resolution.
              </p>
            </article>
            <article className="phase-card">
              <span className="phase-label">Phase 3 — Cusp Index</span>
              <p className="phase-desc">
                Later. Portfolio visibility and position intelligence across markets. One view. Capital efficiency.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <p className="footer-copy">© 2026 Cusp Protocol. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
