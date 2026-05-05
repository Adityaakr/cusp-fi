import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Subtle horizontal sweep (still token-safe on dark backgrounds). */
  shimmer?: boolean;
}

function Skeleton({ className, shimmer, ...props }: SkeletonProps) {
  if (shimmer) {
    return (
      <div className={cn("relative overflow-hidden rounded-md bg-muted", className)} {...props}>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/12 to-transparent animate-skeleton-shimmer"
          aria-hidden
        />
      </div>
    );
  }
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
