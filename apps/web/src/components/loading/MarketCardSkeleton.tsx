import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for Index “Markets you can collateralize” tiles. */
export function MarketCardSkeleton({ shimmer }: { shimmer?: boolean }) {
  return (
    <div className="bg-bg-1 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-9" shimmer={shimmer} />
        <Skeleton className="h-4 w-14" shimmer={shimmer} />
      </div>
      <Skeleton className="h-4 w-full mb-1.5" shimmer={shimmer} />
      <Skeleton className="h-4 w-[88%] mb-3" shimmer={shimmer} />
      <Skeleton className="h-1.5 w-full rounded-full mb-2" shimmer={shimmer} />
      <div className="flex justify-between mt-2">
        <Skeleton className="h-3 w-11" shimmer={shimmer} />
        <Skeleton className="h-3 w-9" shimmer={shimmer} />
      </div>
    </div>
  );
}
