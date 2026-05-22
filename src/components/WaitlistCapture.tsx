import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WaitlistSignupState } from "@/hooks/useWaitlistSignup";
import { cn } from "@/lib/utils";

interface WaitlistCaptureProps {
  waitlist: WaitlistSignupState;
  variant?: "compact" | "immersive";
  title?: string;
  description?: string;
  className?: string;
  formClassName?: string;
  showCount?: boolean;
  countLabel?: string;
  successTitle?: string;
  successDescription?: string;
  submitLabel?: string;
}

const WaitlistCapture = ({
  waitlist,
  variant = "compact",
  title = "Join the waitlist",
  description = "Early access to Cusp. We'll reach out when you're in.",
  className,
  formClassName,
  showCount = true,
  countLabel = "people on the waitlist",
  successTitle = "You're in.",
  successDescription = "We'll be in touch.",
  submitLabel = "Join",
}: WaitlistCaptureProps) => {
  const isImmersive = variant === "immersive";

  return (
    <div
      className={cn(
        isImmersive
          ? "relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--bg-1)),hsl(var(--bg-0)))] p-6 shadow-[0_0_0_1px_hsl(var(--border)/0.15),0_24px_80px_hsl(var(--cusp-teal)/0.08)] backdrop-blur-xl sm:p-8"
          : "text-center",
        className,
      )}
    >
      {isImmersive && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-20%] top-[-12rem] h-64 rounded-full bg-cusp-teal/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cusp-teal/30 to-transparent"
          />
        </>
      )}

      <div className="relative">
        {showCount && (
          <div
            className={cn(
              "mb-5 inline-flex items-center gap-3 rounded-full border px-4 py-2 text-left",
              isImmersive
                ? "border-cusp-teal/20 bg-cusp-teal/10"
                : "border-border bg-bg-2/80",
            )}
          >
            {waitlist.countLoading ? (
              <span className="text-xs text-muted-foreground">Loading waitlist…</span>
            ) : (
              <>
                <span className="font-mono text-lg font-semibold tabular-nums text-cusp-teal">
                  {waitlist.displayCount.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">{countLabel}</span>
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-cusp-teal motion-safe:animate-pulse"
                />
              </>
            )}
          </div>
        )}

        <h2 className={cn("font-semibold tracking-tight text-foreground", isImmersive ? "text-3xl sm:text-4xl" : "text-2xl md:text-3xl")}>
          {title}
        </h2>
        <p className={cn("mt-3 text-sm leading-relaxed text-muted-foreground", isImmersive ? "max-w-md" : "mx-auto max-w-md")}>
          {description}
        </p>

        {waitlist.status === "success" ? (
          <div
            className={cn(
              "mt-6 rounded-2xl border px-5 py-4",
              isImmersive
                ? "border-cusp-teal/25 bg-cusp-teal/10 text-left"
                : "border-cusp-green/20 bg-cusp-green/10 text-center",
            )}
          >
            <p className="text-sm font-medium text-foreground">{successTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{successDescription}</p>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await waitlist.submit();
            }}
            className={cn(
              "mt-6",
              isImmersive ? "space-y-3" : "mx-auto flex max-w-sm gap-2",
              formClassName,
            )}
          >
            <Input
              type="email"
              value={waitlist.email}
              onChange={(e) => waitlist.setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={waitlist.status === "loading"}
              aria-label="Email address"
              aria-busy={waitlist.status === "loading"}
              className={cn(
                "border-border/60 bg-white/[0.06] placeholder:text-muted-foreground text-foreground",
                isImmersive && "h-12 rounded-xl border-white/10 bg-white/5 px-4",
              )}
            />
            <Button
              type="submit"
              disabled={waitlist.status === "loading"}
              className={cn(
                "font-semibold",
                isImmersive
                  ? "h-12 w-full rounded-xl bg-cusp-teal text-primary-foreground shadow-[0_0_32px_hsl(var(--cusp-teal)/0.2)] hover:bg-cusp-teal/90"
                  : "px-5",
              )}
            >
              {waitlist.status === "loading" ? "Joining..." : submitLabel}
            </Button>
          </form>
        )}

        {waitlist.status === "error" && (
          <p className={cn("mt-3 text-xs text-cusp-red", isImmersive ? "text-left" : "text-center")}>
            {waitlist.error}
          </p>
        )}
      </div>
    </div>
  );
};

export default WaitlistCapture;
