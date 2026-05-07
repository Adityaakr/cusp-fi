import { Skeleton } from "@/components/ui/skeleton";

function DesktopRow({ narrow }: { narrow?: boolean }) {
  return (
    <tr className="border-b border-border">
      <td className="px-2 py-2 min-w-[200px]">
        <Skeleton className="h-4 w-[min(100%,18rem)] mb-1" />
        {!narrow && <Skeleton className="h-3 w-32" />}
      </td>
      <td className="px-2 py-2 w-36">
        <Skeleton className="h-2 w-[120px] rounded-full" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-10 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-10 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-8 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-12 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-12 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-14 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-4 w-10 ml-auto" />
      </td>
      <td className="px-2 py-2 text-right">
        <Skeleton className="h-6 w-20 ml-auto rounded-md" />
      </td>
    </tr>
  );
}

function MobileBlock() {
  return (
    <div className="p-3 space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-2 w-full rounded-full max-w-[200px]" />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex justify-between pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

/** `<tr>` rows for desktop markets table loading / pagination tail. */
export function MarketsTableSkeletonDesktopRows({
  rows = 10,
  narrowAfter = 5,
}: {
  rows?: number;
  narrowAfter?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <DesktopRow key={i} narrow={i >= narrowAfter} />
      ))}
    </>
  );
}

/** Stacked blocks for mobile markets list. */
export function MarketsTableSkeletonMobileBlocks({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <MobileBlock key={i} />
      ))}
    </>
  );
}
