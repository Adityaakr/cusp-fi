import { Skeleton } from "@/components/ui/skeleton";

/** Left rail placeholder on `/markets` while tags or first page load. */
export function MarketsCategorySidebarSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <nav
      className="rounded-lg border border-border bg-bg-1 overflow-hidden flex flex-col max-h-[min(70vh,42rem)] lg:max-h-[calc(100vh-5.5rem)]"
      aria-hidden
    >
      <div className="overflow-y-auto py-2 px-2 space-y-2 flex-1 min-h-0">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" shimmer={i < 3} />
        ))}
      </div>
    </nav>
  );
}
