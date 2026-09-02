import { ChartSkeleton, Skeleton, StatGridSkeleton } from "@/components/ui/skeleton";

export default function ChallengeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-32 w-full rounded-xl" />
      <div className="mt-8">
        <StatGridSkeleton />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
