import { Activity, CalendarCheck, Flame, Target, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { ChallengeHeader } from "@/components/challenge-header";
import { DailySolvedChart, ParticipationChart, WeeklySolvedChart } from "@/components/challenge-charts";
import { DifficultyBars, DifficultyLegend } from "@/components/difficulty-chart";
import { StatCard } from "@/components/stat-card";
import { ErrorState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChallengeOverview, type ChallengeOverview } from "@/lib/services/challenge-stats";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Challenge Overview",
  description: "College-wide progress across the four-month LeetCode challenge.",
};

export default async function ChallengePage() {
  let overview: ChallengeOverview | null = null;
  try {
    overview = await getChallengeOverview();
  } catch {
    overview = null;
  }

  if (!overview) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <ErrorState
          title="We couldn't load the challenge overview"
          description="The statistics service is temporarily unavailable. Please refresh in a moment."
        />
      </div>
    );
  }

  const { settings, timeline } = overview;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Challenge overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every figure here counts only work done between{" "}
          {formatDate(settings.startDate, settings.timezone)} and{" "}
          {formatDate(settings.endDate, settings.timezone)}, in {settings.timezone}.
        </p>
      </header>

      <ChallengeHeader settings={settings} timeline={timeline} />

      <Timeline overview={overview} />

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Participants"
          value={overview.participants}
          icon={<Users className="size-3.5" />}
          hint={`${formatNumber(overview.activeParticipants)} have solved at least one`}
        />
        <StatCard
          label="Problems solved"
          value={overview.totalSolved}
          icon={<Target className="size-3.5" />}
          hint="during the challenge"
        />
        <StatCard
          label="Challenge points"
          value={overview.totalPoints}
          icon={<TrendingUp className="size-3.5" />}
          tone="accent"
        />
        <StatCard
          label="Average per student"
          value={overview.averagePerStudent}
          icon={<Activity className="size-3.5" />}
          hint="problems solved"
        />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Solved today"
          value={overview.solvedToday}
          icon={<CalendarCheck className="size-3.5" />}
          hint="students active today"
        />
        <StatCard
          label="Most active day"
          value={
            overview.mostActiveDay
              ? formatDate(new Date(`${overview.mostActiveDay.day}T00:00:00Z`), "UTC")
              : "—"
          }
          hint={
            overview.mostActiveDay
              ? `${formatNumber(overview.mostActiveDay.solved)} problems solved`
              : "no activity yet"
          }
        />
        <StatCard
          label="Longest streak"
          value={overview.longestStreak?.value ?? 0}
          icon={<Flame className="size-3.5" />}
          hint={overview.longestStreak ? overview.longestStreak.name : "no streaks yet"}
        />
        <LeaderCard overview={overview} />
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Problems solved per day</CardTitle>
          </CardHeader>
          <CardContent>
            <DailySolvedChart data={overview.daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Problems solved per week</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklySolvedChart data={overview.weekly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participation over time</CardTitle>
            <p className="text-xs text-subtle">Students solving at least one problem each day.</p>
          </CardHeader>
          <CardContent>
            <ParticipationChart data={overview.daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Difficulty distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DifficultyBars data={overview.difficultyTotals} />
            <DifficultyLegend data={overview.difficultyTotals} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LeaderCard({ overview }: { overview: ChallengeOverview }) {
  if (!overview.leader) {
    return <StatCard label="Current leader" value="—" hint="no solves recorded yet" />;
  }

  return (
    <Link
      href={`/student/${overview.leader.username}`}
      className="rounded-xl border border-[var(--border)] bg-surface p-5 transition-colors hover:border-[var(--border-strong)]"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">Current leader</p>
      <div className="mt-2 flex items-center gap-2">
        <Avatar initials={overview.leader.initials} name={overview.leader.name} size="sm" />
        <span className="truncate text-lg font-semibold tracking-tight">
          {overview.leader.name}
        </span>
      </div>
      <p className="tabular mt-1 text-xs text-muted">
        {formatNumber(overview.leader.solved)} solved · {formatNumber(overview.leader.points)} pts
      </p>
    </Link>
  );
}

/**
 * September to December, drawn as a single bar with a marker for today.
 * A four-month challenge is easier to feel as a line than as two dates.
 */
function Timeline({ overview }: { overview: ChallengeOverview }) {
  const { monthly, timeline } = overview;
  const elapsedPercent = Math.min(100, Math.max(0, timeline.progress * 100));

  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-surface p-5 sm:p-6">
      <h2 className="text-sm font-semibold tracking-tight">Timeline</h2>

      <div className="relative mt-5">
        <div className="flex gap-1">
          {monthly.map((month) => (
            <div key={month.key} className="flex-1">
              <div
                className={`h-2 rounded-full ${month.started ? "bg-accent/70" : "bg-surface-muted"}`}
              />
              <p
                className={`mt-2 text-xs font-medium ${month.started ? "text-foreground" : "text-subtle"}`}
              >
                {month.label}
              </p>
              <p className="tabular text-xs text-subtle">
                {month.started ? `${formatNumber(month.solved)} solved` : "upcoming"}
              </p>
              {month.started ? (
                <p className="tabular text-xs text-subtle">{formatNumber(month.points)} pts</p>
              ) : null}
            </div>
          ))}
        </div>

        {timeline.phase === "ACTIVE" ? (
          <div
            className="pointer-events-none absolute -top-1 flex flex-col items-center"
            style={{ left: `${elapsedPercent}%` }}
            aria-hidden
          >
            <span className="size-1.5 rounded-full bg-foreground" />
            <span className="h-4 w-px bg-foreground/40" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
