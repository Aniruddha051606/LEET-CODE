import { Flame, Hash, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { Avatar } from "@/components/avatar";
import { ChallengeHeader } from "@/components/challenge-header";
import { DifficultyDonut, DifficultyLegend } from "@/components/difficulty-chart";
import { MonthlyProgress } from "@/components/monthly-progress";
import { DifficultyBar, ProgressBar } from "@/components/progress-bar";
import { RankMovementIndicator } from "@/components/rank-badge";
import { RecentActivity } from "@/components/recent-activity";
import { StatCard } from "@/components/stat-card";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { challengeTimeline } from "@/lib/challenge/dates";
import { getChallengeSummary } from "@/lib/services/challenge-stats";
import { getStudentDashboard } from "@/lib/services/student";
import { formatDate, formatNumber, pluralise } from "@/lib/utils";
import { usernameParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// NOTE: do not add a `loading.tsx` to this route.
// A loading file creates a Suspense boundary whose fallback is streamed immediately,
// which commits HTTP 200 before `notFound()` below can set 404 — so an unknown student
// would render the correct "not found" page under a misleading 200 status. Verified
// against a production build. /leaderboard and /challenge keep their loading skeletons
// because neither of them ever calls notFound().

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username} · Dashboard`,
    description: `Challenge progress for ${username} in the college LeetCode challenge.`,
  };
}

export default async function StudentDashboardPage({ params }: PageProps) {
  const { username } = await params;

  const parsed = usernameParamSchema.safeParse(decodeURIComponent(username));
  if (!parsed.success) notFound();

  const dashboard = await getStudentDashboard(parsed.data);
  if (!dashboard) notFound();

  const summary = await getChallengeSummary().catch(() => null);
  const timeline = challengeTimeline(dashboard.settings);

  // The comparison for the progress bar: the current leader's total, so the bar means
  // "how far along am I relative to the front of the field" rather than an arbitrary goal.
  const leaderSolved = summary?.leader?.solved ?? 0;
  const averageSolved =
    summary && summary.participants > 0
      ? Math.round((summary.totalSolved / summary.participants) * 10) / 10
      : 0;
  const progressTarget = Math.max(leaderSolved, dashboard.challenge.solved, 1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {/* ---- Header -------------------------------------------------------- */}
      <header className="flex flex-col gap-6 border-b border-[var(--border)] pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Avatar initials={dashboard.initials} name={dashboard.name} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{dashboard.name}</h1>
            <a
              href={dashboard.profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-muted hover:text-accent"
            >
              @{dashboard.username}
            </a>
            <p className="mt-1 text-xs text-subtle">
              Joined {formatDate(dashboard.joinedAt, dashboard.settings.timezone)}
            </p>
          </div>
        </div>

        <div className="flex gap-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Challenge rank</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-3xl font-semibold">
                {dashboard.rank !== null ? `#${dashboard.rank}` : "—"}
              </span>
              <RankMovementIndicator
                movement={dashboard.movement}
                delta={dashboard.movementDelta}
              />
            </div>
            <p className="text-xs text-subtle">of {formatNumber(dashboard.totalParticipants)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Points</p>
            <p className="tabular mt-1 text-3xl font-semibold text-accent">
              {formatNumber(dashboard.challenge.points)}
            </p>
            <p className="text-xs text-subtle">
              {dashboard.settings.easyPoints}/{dashboard.settings.mediumPoints}/
              {dashboard.settings.hardPoints} per E/M/H
            </p>
          </div>
        </div>
      </header>

      {/* ---- Motivation ---------------------------------------------------- */}
      {dashboard.motivation.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {dashboard.motivation.map((line) => (
            <li key={line}>
              <Badge variant="accent" className="px-3 py-1 text-xs">
                {line}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <SyncStatus
        username={dashboard.username}
        status={dashboard.sync.status}
        lastSyncedAt={dashboard.sync.lastSyncedAt?.toISOString() ?? null}
        className="mt-6 rounded-lg border border-[var(--border)] bg-surface px-4 py-3"
      />

      {/* ---- Main stats ----------------------------------------------------- */}
      <section className="mt-8" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Challenge statistics
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Solved in challenge"
            value={dashboard.challenge.solved}
            icon={<Target className="size-3.5" />}
            hint={`${formatNumber(dashboard.lifetime.total)} lifetime on LeetCode`}
          />
          <StatCard
            label="Points"
            value={dashboard.challenge.points}
            tone="accent"
            icon={<Trophy className="size-3.5" />}
            hint={dashboard.percentile !== null ? `Top ${dashboard.percentile}%` : undefined}
          />
          <StatCard
            label="Current streak"
            value={dashboard.streaks.current}
            icon={<Flame className="size-3.5" />}
            hint={`${pluralise(dashboard.streaks.current, "day")} in a row`}
          />
          <StatCard
            label="Longest streak"
            value={dashboard.streaks.longest}
            icon={<Hash className="size-3.5" />}
            hint={`best run this challenge`}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatCard label="Easy" value={dashboard.challenge.easy} tone="easy" />
          <StatCard label="Medium" value={dashboard.challenge.medium} tone="medium" />
          <StatCard label="Hard" value={dashboard.challenge.hard} tone="hard" />
        </div>
      </section>

      {/* ---- Progress ------------------------------------------------------- */}
      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="tabular">{formatNumber(dashboard.challenge.solved)}</span>{" "}
              <span className="text-base font-normal text-muted">
                {pluralise(dashboard.challenge.solved, "problem")} solved during the challenge
              </span>
            </p>
            <p className="mt-1 text-xs text-subtle">
              College average is {averageSolved}
              {leaderSolved > 0 ? ` · leader is on ${formatNumber(leaderSolved)}` : ""}
            </p>
          </div>
          <span className="tabular text-xs text-subtle">
            Day {timeline.daysElapsed} of {timeline.totalDays}
          </span>
        </div>

        <ProgressBar
          value={dashboard.challenge.solved}
          total={progressTarget}
          className="mt-4 h-2.5"
          label="Problems solved relative to the current leader"
        />
        <DifficultyBar
          easy={dashboard.challenge.easy}
          medium={dashboard.challenge.medium}
          hard={dashboard.challenge.hard}
          className="mt-2"
        />
      </Card>

      {/* ---- Charts and ranks ------------------------------------------------ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Difficulty distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DifficultyDonut
              data={{
                easy: dashboard.challenge.easy,
                medium: dashboard.challenge.medium,
                hard: dashboard.challenge.hard,
              }}
            />
            <DifficultyLegend
              data={{
                easy: dashboard.challenge.easy,
                medium: dashboard.challenge.medium,
                hard: dashboard.challenge.hard,
              }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap days={dashboard.activity} timezone={dashboard.settings.timezone} />
          </CardContent>
        </Card>
      </div>

      {/* ---- Rankings -------------------------------------------------------- */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Challenge rank"
          value={dashboard.rank !== null ? `#${dashboard.rank}` : "—"}
          hint="the ranking that counts"
        />
        <StatCard
          label="This week"
          value={dashboard.weeklyRank !== null ? `#${dashboard.weeklyRank}` : "—"}
          hint="by problems solved in the last 7 days"
        />
        <StatCard
          label="This month"
          value={dashboard.monthlyRank !== null ? `#${dashboard.monthlyRank}` : "—"}
          hint="by problems solved this month"
        />
      </div>

      {/* ---- Monthly --------------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Monthly progress</h2>
        <MonthlyProgress months={dashboard.monthly} className="mt-4" />
      </section>

      {/* ---- Recent ---------------------------------------------------------- */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <p className="text-xs text-subtle">
              LeetCode publishes only the most recent accepted submissions, so this feed shows what
              our syncs observed rather than every problem you solved.
            </p>
          </CardHeader>
          <CardContent>
            <RecentActivity items={dashboard.recent} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ChallengeHeader settings={dashboard.settings} timeline={timeline} />
          <Card className="p-5">
            <p className="text-sm font-medium">Lifetime on LeetCode</p>
            <p className="mt-1 text-xs text-subtle">
              Shown for context only. None of this counts towards the challenge.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Total solved" value={formatNumber(dashboard.lifetime.total)} />
              <Row label="Easy" value={formatNumber(dashboard.lifetime.easy)} />
              <Row label="Medium" value={formatNumber(dashboard.lifetime.medium)} />
              <Row label="Hard" value={formatNumber(dashboard.lifetime.hard)} />
              {dashboard.lifetime.globalRanking !== null ? (
                <Row
                  label="Global ranking"
                  value={formatNumber(dashboard.lifetime.globalRanking)}
                />
              ) : null}
            </dl>
          </Card>

          <Link
            href="/leaderboard"
            className="block rounded-xl border border-[var(--border)] bg-surface p-4 text-sm text-muted transition-colors hover:border-[var(--border-strong)] hover:text-foreground"
          >
            See the full leaderboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}
