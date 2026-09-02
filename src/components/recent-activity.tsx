import { ExternalLink } from "lucide-react";

import { EmptyState } from "@/components/states";
import { Badge, difficultyLabel, difficultyVariant } from "@/components/ui/badge";
import type { RecentSolve } from "@/lib/services/student";
import { formatRelative } from "@/lib/utils";

/**
 * Recently detected solves.
 *
 * LeetCode publishes only the last 20 accepted submissions, so this list is what our
 * syncs have managed to observe rather than a complete history. The dashboard says so
 * plainly rather than implying the feed is exhaustive.
 */
export function RecentActivity({ items }: { items: readonly RecentSolve[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No challenge activity yet."
        description="Solve a problem on LeetCode and it will show up here after the next refresh."
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((item) => (
        <li key={item.slug} className="flex items-center justify-between gap-3 py-3 first:pt-0">
          <div className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent"
            >
              <span className="truncate">{item.title}</span>
              <ExternalLink className="size-3 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            <p className="text-xs text-subtle">{formatRelative(item.solvedAt)}</p>
          </div>
          <Badge variant={difficultyVariant(item.difficulty)} className="shrink-0">
            {difficultyLabel(item.difficulty)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
