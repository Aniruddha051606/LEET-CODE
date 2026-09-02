import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import type { RankMovement } from "@/lib/challenge/ranking";
import { cn } from "@/lib/utils";

/**
 * Rank display. The top three get a distinct treatment; everyone else gets a plain
 * tabular number, which keeps the leaderboard readable rather than decorated.
 */
export function RankBadge({ rank, className }: { rank: number | null; className?: string }) {
  if (rank === null) {
    return <span className={cn("tabular text-sm text-subtle", className)}>—</span>;
  }

  if (rank <= 3) {
    const tone = {
      1: "border-[var(--gold)] text-[var(--gold)] bg-[color-mix(in_oklab,var(--gold)_12%,transparent)]",
      2: "border-[var(--silver)] text-[var(--silver)] bg-[color-mix(in_oklab,var(--silver)_12%,transparent)]",
      3: "border-[var(--bronze)] text-[var(--bronze)] bg-[color-mix(in_oklab,var(--bronze)_12%,transparent)]",
    }[rank as 1 | 2 | 3];

    return (
      <span
        className={cn(
          "tabular inline-flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
          tone,
          className,
        )}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className={cn("tabular inline-flex size-8 items-center justify-center text-sm text-muted", className)}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

/** Arrow showing how far a student moved since the last rank recomputation. */
export function RankMovementIndicator({
  movement,
  delta,
  className,
}: {
  movement: RankMovement;
  delta: number;
  className?: string;
}) {
  if (movement === "NEW") {
    return <span className={cn("text-xs text-subtle", className)}>new</span>;
  }
  if (movement === "SAME") {
    return (
      <span className={cn("inline-flex items-center text-subtle", className)} aria-label="No change">
        <Minus className="size-3.5" />
      </span>
    );
  }

  const up = movement === "UP";
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-easy" : "text-hard",
        className,
      )}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "place" : "places"}`}
    >
      <Icon className="size-3.5" />
      {Math.abs(delta)}
    </span>
  );
}
