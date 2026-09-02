import type { Metadata } from "next";

import { HighlightCurrentStudent, LeaderboardControls } from "@/components/leaderboard-controls";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Pagination } from "@/components/pagination";
import { ErrorState } from "@/components/states";
import { getChallengeSettings } from "@/lib/challenge/config";
import { challengeTimeline } from "@/lib/challenge/dates";
import { getLeaderboard, type LeaderboardPage } from "@/lib/services/leaderboard";
import { leaderboardQuerySchema } from "@/lib/validation";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Live standings for the college LeetCode challenge, ranked by problems solved during the challenge.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const first = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Invalid query strings fall back to defaults rather than erroring the page.
  const parsed = leaderboardQuerySchema.safeParse({
    page: first("page") ?? undefined,
    pageSize: first("pageSize") ?? undefined,
    search: first("search") ?? undefined,
    sort: first("sort") ?? undefined,
  });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 25, sort: "RANK" as const };

  let result: LeaderboardPage | null = null;
  let scoringLabel: string | null = null;
  let phaseNote: string | null = null;

  try {
    const [leaderboard, settings] = await Promise.all([getLeaderboard(query), getChallengeSettings()]);
    result = leaderboard;
    scoringLabel = `Easy ${settings.easyPoints} · Medium ${settings.mediumPoints} · Hard ${settings.hardPoints}`;
    const timeline = challengeTimeline(settings);
    phaseNote =
      timeline.phase === "ACTIVE"
        ? `Day ${timeline.daysElapsed} of ${timeline.totalDays}`
        : timeline.phase === "BEFORE"
          ? "Starts soon"
          : "Final standings";
  } catch {
    result = null;
  }

  function buildHref(page: number): string {
    const next = new URLSearchParams();
    if (query.search) next.set("search", query.search);
    if (query.sort && query.sort !== "RANK") next.set("sort", query.sort);
    if (page > 1) next.set("page", String(page));
    const suffix = next.toString();
    return suffix ? `/leaderboard?${suffix}` : "/leaderboard";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Ranked by problems solved <span className="text-foreground">during the challenge</span>,
              with points breaking ties. Lifetime LeetCode totals do not count here.
            </p>
          </div>
          <div className="text-right text-xs text-subtle">
            {phaseNote ? <p>{phaseNote}</p> : null}
            {scoringLabel ? <p className="tabular mt-0.5">{scoringLabel}</p> : null}
          </div>
        </div>
      </header>

      {result === null ? (
        <ErrorState
          title="We couldn't load the leaderboard"
          description="The standings service is temporarily unavailable. Please refresh in a moment."
        />
      ) : (
        <div className="space-y-5">
          <LeaderboardControls total={result.total} />

          {query.search && result.total === 0 ? (
            <ErrorState
              title={`No students match "${query.search}"`}
              description="Try a different name or LeetCode username."
            />
          ) : (
            <LeaderboardTable rows={result.rows} />
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="tabular text-xs text-subtle">
              Showing {formatNumber(result.rows.length)} of {formatNumber(result.total)} students
            </p>
            <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
          </div>
        </div>
      )}

      <HighlightCurrentStudent />
    </div>
  );
}
