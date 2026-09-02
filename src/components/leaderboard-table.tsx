import { Flame } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { RankBadge, RankMovementIndicator } from "@/components/rank-badge";
import { EmptyState } from "@/components/states";
import type { LeaderboardRow } from "@/lib/services/leaderboard";
import { cn, formatNumber } from "@/lib/utils";

/**
 * The leaderboard.
 *
 * Rendered on the server from stored standings. Two presentations of the same rows: a
 * table from `sm` upwards, and stacked cards on phones, because a seven-column table is
 * not usable on a 375px screen no matter how much you let it scroll sideways.
 *
 * Ranking is by problems solved during the challenge, then by challenge points. Lifetime
 * LeetCode totals appear nowhere on this page.
 */
export function LeaderboardTable({
  rows,
  emptyMessage = "No students have joined the challenge yet.",
}: {
  rows: readonly LeaderboardRow[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description="Once students join and their first sync completes, the standings appear here."
      />
    );
  }

  return (
    <>
      {/* Desktop and tablet */}
      <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] bg-surface sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Challenge leaderboard, ranked by problems solved during the challenge
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)] bg-surface-muted text-xs uppercase tracking-wider text-subtle">
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Rank
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Student
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Solved
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Easy
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Medium
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Hard
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Streak
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Points
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr
                key={row.username}
                data-username={row.username.toLowerCase()}
                className="group transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RankBadge rank={row.rank} />
                    <RankMovementIndicator movement={row.movement} delta={row.movementDelta} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/student/${row.username}`}
                    className="flex items-center gap-3 hover:text-accent"
                  >
                    <Avatar initials={row.initials} name={row.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.name}</span>
                      <span className="block truncate text-xs text-subtle">@{row.username}</span>
                    </span>
                  </Link>
                </td>
                <td className="tabular px-4 py-3 text-right font-semibold">
                  {formatNumber(row.challengeSolved)}
                </td>
                <td className="tabular px-3 py-3 text-right text-easy">{row.easy}</td>
                <td className="tabular px-3 py-3 text-right text-medium">{row.medium}</td>
                <td className="tabular px-3 py-3 text-right text-hard">{row.hard}</td>
                <td className="tabular px-3 py-3 text-right">
                  <StreakCell value={row.currentStreak} />
                </td>
                <td className="tabular px-4 py-3 text-right font-semibold">
                  {formatNumber(row.points)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.username}
            data-username={row.username.toLowerCase()}
            className="rounded-xl border border-[var(--border)] bg-surface p-4"
          >
            <Link href={`/student/${row.username}`} className="flex items-center gap-3">
              <RankBadge rank={row.rank} />
              <Avatar initials={row.initials} name={row.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="block truncate text-xs text-subtle">@{row.username}</span>
              </span>
              <span className="text-right">
                <span className="tabular block text-lg font-semibold leading-none">
                  {formatNumber(row.challengeSolved)}
                </span>
                <span className="text-[11px] text-subtle">solved</span>
              </span>
            </Link>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs">
              <span className="flex gap-2">
                <span className="text-easy">{row.easy}E</span>
                <span className="text-medium">{row.medium}M</span>
                <span className="text-hard">{row.hard}H</span>
              </span>
              <span className="flex items-center gap-3">
                <StreakCell value={row.currentStreak} />
                <span className="tabular font-medium">{formatNumber(row.points)} pts</span>
                <RankMovementIndicator movement={row.movement} delta={row.movementDelta} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function StreakCell({ value }: { value: number }) {
  if (value <= 0) return <span className="text-subtle">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", value >= 3 ? "text-medium" : "text-muted")}>
      {value >= 3 ? <Flame className="size-3.5" /> : null}
      {value}
    </span>
  );
}
