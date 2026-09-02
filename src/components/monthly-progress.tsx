import type { MonthlyProgressEntry } from "@/lib/services/student";
import { cn, formatNumber } from "@/lib/utils";

/**
 * September through December at a glance.
 *
 * Months the challenge has not reached yet are shown greyed rather than hidden, so the
 * shape of the whole challenge stays visible from day one.
 */
export function MonthlyProgress({
  months,
  className,
}: {
  months: readonly MonthlyProgressEntry[];
  className?: string;
}) {
  const peak = Math.max(1, ...months.map((month) => month.solved));

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {months.map((month) => (
        <div
          key={month.key}
          className={cn(
            "rounded-lg border border-[var(--border)] p-4",
            month.started ? "bg-surface" : "bg-surface-muted/50",
          )}
        >
          <div className="flex items-baseline justify-between">
            <p
              className={cn(
                "text-sm font-medium",
                month.started ? "text-foreground" : "text-subtle",
              )}
            >
              {month.label}
            </p>
            {month.started ? (
              <span className="tabular text-xs text-subtle">{formatNumber(month.points)} pts</span>
            ) : (
              <span className="text-xs text-subtle">upcoming</span>
            )}
          </div>

          <p
            className={cn(
              "tabular mt-2 text-2xl font-semibold",
              month.started ? "text-foreground" : "text-subtle",
            )}
          >
            {month.started ? formatNumber(month.solved) : "—"}
          </p>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${month.started ? (month.solved / peak) * 100 : 0}%` }}
            />
          </div>

          {month.started && month.solved > 0 ? (
            <p className="mt-2 text-xs text-subtle">
              <span className="text-easy">{month.easy}E</span>{" "}
              <span className="text-medium">{month.medium}M</span>{" "}
              <span className="text-hard">{month.hard}H</span>
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
