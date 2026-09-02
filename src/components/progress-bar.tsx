import { cn, percent } from "@/lib/utils";

export function ProgressBar({
  value,
  total,
  className,
  barClassName,
  label,
}: {
  value: number;
  total: number;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const pct = percent(value, total);

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-500", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Stacked easy / medium / hard bar. Uses the same three colours as the charts and
 * badges so the difficulty mapping is learned once and holds everywhere.
 */
export function DifficultyBar({
  easy,
  medium,
  hard,
  className,
}: {
  easy: number;
  medium: number;
  hard: number;
  className?: string;
}) {
  const total = easy + medium + hard;

  if (total === 0) {
    return <div className={cn("h-2 w-full rounded-full bg-surface-muted", className)} />;
  }

  const segments = [
    { value: easy, color: "var(--easy)", label: "Easy" },
    { value: medium, color: "var(--medium)", label: "Medium" },
    { value: hard, color: "var(--hard)", label: "Hard" },
  ];

  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}>
      {segments.map((segment) =>
        segment.value === 0 ? null : (
          <div
            key={segment.label}
            style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
            title={`${segment.label}: ${segment.value}`}
          />
        ),
      )}
    </div>
  );
}
