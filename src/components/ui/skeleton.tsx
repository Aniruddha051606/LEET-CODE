import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}

/** Placeholder matching the shape of a stat card grid. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-[var(--border)] bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder matching the leaderboard table. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-surface">
      <div className="border-b border-[var(--border)] bg-surface-muted p-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 p-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-48" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="hidden h-4 w-10 sm:block" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-xl", className)} />;
}
