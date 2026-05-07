import type { QvacFlowStep } from "@/components/qvac/qvacFlows";
import { Search } from "lucide-react";
import { useState, useCallback } from "react";

interface QvacStepInputProps {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit: () => void;
  isValid: boolean;
}

export default function QvacStepInput({ step, value, onChange, onSubmit, isValid }: QvacStepInputProps) {
  if (step.type === "amount") {
    return <AmountInput step={step} value={value} onChange={onChange} onSubmit={onSubmit} isValid={isValid} />;
  }
  if (step.type === "select") {
    return <SelectInput step={step} value={value} onChange={onChange} />;
  }
  if (step.type === "market_search") {
    return <MarketSearchInput step={step} value={value} onChange={onChange} />;
  }
  return null;
}

function AmountInput({
  step,
  value,
  onChange,
  onSubmit,
  isValid,
}: {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit: () => void;
  isValid: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) onSubmit();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          type="number"
          value={value != null && value !== "" ? String(value) : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder={step.placeholder || "0.00"}
          min={step.min ?? 0}
          max={step.max}
          step="any"
          className="w-full rounded-lg border border-border bg-bg-0 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50 focus:border-cusp-teal pr-16"
          autoFocus
        />
        {step.asset && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
            {step.asset}
          </span>
        )}
      </div>
      {step.validation && value != null && value !== "" && step.validation(value) && (
        <p className="text-xs text-destructive">{step.validation(value)}</p>
      )}
    </div>
  );
}

function SelectInput({
  step,
  value,
  onChange,
}: {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (!step.options) return null;

  return (
    <div className="flex flex-col gap-2">
      {step.options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
            value === opt.value
              ? "border-cusp-teal bg-cusp-teal/10 text-cusp-teal"
              : "border-border hover:border-cusp-teal/50 text-foreground"
          }`}
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">{opt.label}</span>
            {opt.description && (
              <span className={`text-xs ${value === opt.value ? "text-cusp-teal/70" : "text-muted-foreground"}`}>
                {opt.description}
              </span>
            )}
          </div>
          {value === opt.value && (
            <svg className="size-4 text-cusp-teal shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

function MarketSearchInput({
  step,
  value,
  onChange,
}: {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<Array<{ ticker: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);

  const searchMarkets = useCallback(async (q: string) => {
    if (q.length < 2) {
      setMarkets([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/dflow/markets?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data)
          ? data.map((m: { ticker: string; title?: string }) => ({ ticker: m.ticker, title: m.title || m.ticker }))
          : [];
        setMarkets(results.slice(0, 8));
      }
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    searchMarkets(q);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={step.placeholder || "Search markets..."}
          className="w-full rounded-lg border border-border bg-bg-0 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50 focus:border-cusp-teal"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-cusp-teal border-t-transparent" />
        )}
      </div>
      {markets.length > 0 && (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-0">
          {markets.map((m) => (
            <button
              key={m.ticker}
              onClick={() => {
                onChange(m.ticker);
                setQuery(m.title);
                setMarkets([]);
              }}
              className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                value === m.ticker
                  ? "bg-cusp-teal/10 text-cusp-teal"
                  : "text-foreground hover:bg-bg-2"
              }`}
            >
              <span className="font-medium">{m.title}</span>
              <span className="text-xs text-muted-foreground font-mono">{m.ticker}</span>
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="flex items-center gap-2 text-xs text-cusp-teal">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Selected: <span className="font-medium">{String(value)}</span>
        </div>
      )}
    </div>
  );
}