import type { ReactNode } from "react";

import { cn, formatNumber } from "@/lib/utils";

/**
 * The primary unit of information across the product: one label, one large number,
 * optionally one line of context. Deliberately plain so that a grid of them reads as
 * data rather than as decoration.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: number | string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "accent" | "easy" | "medium" | "hard";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    accent: "text-accent",
    easy: "text-easy",
    medium: "text-medium",
    hard: "text-hard",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-surface p-5 transition-colors hover:border-[var(--border-strong)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
        {icon ? <span className="text-subtle">{icon}</span> : null}
      </div>
      <p className={cn("tabular mt-2 text-3xl font-semibold tracking-tight", toneClass)}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/** Compact variant for dense rows such as the challenge overview strip. */
export function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs uppercase tracking-wider text-subtle">{label}</p>
      <p className="tabular text-xl font-semibold tracking-tight">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}
