import { AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminStudentSearch,
  AdminToolbar,
  ChallengeConfigForm,
  StudentActions,
} from "@/components/admin/admin-controls";
import { Avatar } from "@/components/avatar";
import { DailySolvedChart, ParticipationChart, WeeklySolvedChart } from "@/components/challenge-charts";
import { DifficultyBars } from "@/components/difficulty-chart";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminAuthenticated } from "@/lib/auth/admin";
import { getChallengeSettings } from "@/lib/challenge/config";
import { getAdminExtras, getSyncHealth, listStudents } from "@/lib/services/admin";
import { getChallengeOverview } from "@/lib/services/challenge-stats";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  // The guard lives here rather than in a layout so that /admin/login stays reachable.
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : undefined;
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const [overview, health, extras, roster, settings] = await Promise.all([
    getChallengeOverview(),
    getSyncHealth(),
    getAdminExtras(),
    listStudents({ search, page, pageSize: 25 }),
    getChallengeSettings(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Challenge administration</h1>
          <p className="mt-1 text-sm text-muted">{settings.challengeName}</p>
        </div>
        <AdminToolbar />
      </header>

      {/* ---- Totals --------------------------------------------------------- */}
      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total students"
          value={overview.participants}
          icon={<Users className="size-3.5" />}
          hint={extras.demoStudents > 0 ? `${extras.demoStudents} demo rows present` : undefined}
        />
        <StatCard
          label="Active students"
          value={overview.activeParticipants}
          hint="solved at least one problem"
        />
        <StatCard label="Solved today" value={extras.solvedToday} hint="students active today" />
        <StatCard
          label="Total solved"
          value={overview.totalSolved}
          hint={`${formatNumber(overview.totalPoints)} points`}
        />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Average / student" value={overview.averagePerStudent} />
        <StatCard
          label="Longest streak"
          value={overview.longestStreak?.value ?? 0}
          hint={overview.longestStreak?.name ?? "no streaks yet"}
        />
        <StatCard
          label="Current leader"
          value={overview.leader?.name ?? "—"}
          hint={overview.leader ? `${formatNumber(overview.leader.solved)} solved` : undefined}
        />
        <StatCard
          label="Failed syncs"
          value={health.failed}
          tone={health.failed > 0 ? "hard" : "default"}
          hint={`${health.neverSynced} never synced`}
        />
      </section>

      {/* ---- Charts --------------------------------------------------------- */}
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
          </CardContent>
        </Card>
      </div>

      {/* ---- Sync health ----------------------------------------------------- */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Synchronisation</CardTitle>
            <p className="text-xs text-subtle">
              Last run {formatRelative(health.lastRunAt)} · oldest student data{" "}
              {formatRelative(health.oldestSyncAt)}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                <CheckCircle2 className="size-3" />
                {health.succeeded} succeeded
              </Badge>
              <Badge variant={health.failed > 0 ? "danger" : "neutral"}>
                <AlertTriangle className="size-3" />
                {health.failed} failed
              </Badge>
              <Badge variant="neutral">
                <Clock className="size-3" />
                {health.pending} pending
              </Badge>
            </div>

            {health.recentRuns.length === 0 ? (
              <p className="text-sm text-muted">No sync has run yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {health.recentRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-muted">
                      <span className="font-medium text-foreground">{run.trigger}</span>{" "}
                      {formatDateTime(run.startedAt, settings.timezone)}
                    </span>
                    <span className="tabular shrink-0 text-xs text-subtle">
                      {run.succeeded}/{run.totalStudents} ok
                      {run.failed > 0 ? ` · ${run.failed} failed` : ""}
                      {run.durationMs !== null ? ` · ${Math.round(run.durationMs / 1000)}s` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failed fetches</CardTitle>
            <p className="text-xs text-subtle">
              These students kept their previous figures. Nothing was replaced with estimates.
            </p>
          </CardHeader>
          <CardContent>
            {health.failures.length === 0 ? (
              <p className="text-sm text-muted">No failing students right now.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {health.failures.map((failure) => (
                  <li key={failure.username} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{failure.name}</span>
                      <span className="tabular text-xs text-subtle">
                        {failure.retryCount} {failure.retryCount === 1 ? "retry" : "retries"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-hard" title={failure.error ?? undefined}>
                      {failure.error ?? "Unknown error"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Configuration ---------------------------------------------------- */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Scoring configuration</CardTitle>
          <p className="text-xs text-subtle">
            Point values are read from here by every score in the product.
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <ChallengeConfigForm settings={settings} />
          </div>
        </CardContent>
      </Card>

      {/* ---- Roster ------------------------------------------------------------ */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Students{" "}
            <span className="tabular text-sm font-normal text-subtle">
              ({formatNumber(roster.total)})
            </span>
          </h2>
          <AdminStudentSearch initial={search ?? ""} />
        </div>

        {roster.rows.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={search ? `No students match "${search}"` : "No students have joined yet."}
          />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-surface">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-surface-muted text-xs uppercase tracking-wider text-subtle">
                  <th scope="col" className="px-4 py-3 text-left font-medium">Student</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Student ID</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Solved</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Points</th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Sync</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {roster.rows.map((student) => (
                  <tr key={student.id} className={student.isActive ? "" : "opacity-55"}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/student/${student.username}`}
                        className="flex items-center gap-2.5 hover:text-accent"
                      >
                        <Avatar initials={student.initials} name={student.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {student.name}
                            {student.isDemo ? (
                              <Badge variant="outline" className="ml-2">demo</Badge>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-subtle">
                            @{student.username}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{student.studentId}</td>
                    <td className="tabular px-3 py-3 text-right font-medium">
                      {formatNumber(student.challengeSolved)}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {formatNumber(student.challengePoints)}
                    </td>
                    <td className="px-3 py-3">
                      <SyncBadge
                        status={student.syncStatus}
                        lastSyncedAt={student.lastSyncedAt}
                        error={student.syncError}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StudentActions
                        studentId={student.id}
                        name={student.name}
                        isActive={student.isActive}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {roster.totalPages > 1 ? (
          <p className="tabular mt-3 text-xs text-subtle">
            Page {roster.page} of {roster.totalPages}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SyncBadge({
  status,
  lastSyncedAt,
  error,
}: {
  status: "PENDING" | "SUCCESS" | "FAILED";
  lastSyncedAt: Date | null;
  error: string | null;
}) {
  if (status === "FAILED") {
    return (
      <span title={error ?? undefined}>
        <Badge variant="danger">failed</Badge>
      </span>
    );
  }
  if (status === "PENDING") return <Badge variant="neutral">pending</Badge>;
  return <span className="text-xs text-subtle">{formatRelative(lastSyncedAt)}</span>;
}
