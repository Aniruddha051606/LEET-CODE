import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-11 w-full max-w-xs" />
      <TableSkeleton rows={10} />
    </div>
  );
}
