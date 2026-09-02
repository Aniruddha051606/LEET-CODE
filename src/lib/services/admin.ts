import "server-only";

import { dayKeyToDateColumn, toDayKey } from "@/lib/challenge/dates";
import { getChallengeSettings } from "@/lib/challenge/config";
import { prisma } from "@/lib/db";

import { initialsOf } from "./leaderboard";

/** Data for the admin dashboard: roster management, sync health and exports. */

export interface AdminStudentRow {
  id: string;
  name: string;
  studentId: string;
  username: string;
  initials: string;
  isActive: boolean;
  isDemo: boolean;
  joinedAt: Date;
  rank: number | null;
  challengeSolved: number;
  challengePoints: number;
  currentStreak: number;
  syncStatus: "PENDING" | "SUCCESS" | "FAILED";
  syncError: string | null;
  retryCount: number;
  lastSyncedAt: Date | null;
}

export interface AdminStudentPage {
  rows: AdminStudentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listStudents(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  onlyFailed?: boolean;
} = {}): Promise<AdminStudentPage> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 25)));
  const search = options.search?.trim();

  const where = {
    ...(options.onlyFailed ? { syncStatus: "FAILED" as const } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { studentId: { contains: search, mode: "insensitive" as const } },
            { leetcodeUsername: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ challengeSolved: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        studentId: true,
        leetcodeUsername: true,
        isActive: true,
        isDemo: true,
        joinedAt: true,
        rank: true,
        challengeSolved: true,
        challengePoints: true,
        currentStreak: true,
        syncStatus: true,
        syncError: true,
        retryCount: true,
        lastSyncedAt: true,
      },
    }),
  ]);

  return {
    rows: students.map((student) => ({
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      username: student.leetcodeUsername,
      initials: initialsOf(student.name),
      isActive: student.isActive,
      isDemo: student.isDemo,
      joinedAt: student.joinedAt,
      rank: student.rank,
      challengeSolved: student.challengeSolved,
      challengePoints: student.challengePoints,
      currentStreak: student.currentStreak,
      syncStatus: student.syncStatus,
      syncError: student.syncError,
      retryCount: student.retryCount,
      lastSyncedAt: student.lastSyncedAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface SyncHealth {
  pending: number;
  failed: number;
  succeeded: number;
  neverSynced: number;
  lastRunAt: Date | null;
  oldestSyncAt: Date | null;
  recentRuns: Array<{
    id: string;
    trigger: string;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    totalStudents: number;
    succeeded: number;
    failed: number;
  }>;
  failures: Array<{ name: string; username: string; error: string | null; retryCount: number }>;
}

export async function getSyncHealth(): Promise<SyncHealth> {
  const [grouped, neverSynced, runs, failures, oldest] = await Promise.all([
    prisma.student.groupBy({ by: ["syncStatus"], _count: { _all: true } }),
    prisma.student.count({ where: { lastSyncedAt: null, isActive: true } }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        totalStudents: true,
        succeeded: true,
        failed: true,
      },
    }),
    prisma.student.findMany({
      where: { syncStatus: "FAILED", isActive: true },
      orderBy: { retryCount: "desc" },
      take: 25,
      select: { name: true, leetcodeUsername: true, syncError: true, retryCount: true },
    }),
    prisma.student.findFirst({
      where: { isActive: true, lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "asc" },
      select: { lastSyncedAt: true },
    }),
  ]);

  const countOf = (status: string): number =>
    grouped.find((row) => row.syncStatus === status)?._count._all ?? 0;

  return {
    pending: countOf("PENDING"),
    failed: countOf("FAILED"),
    succeeded: countOf("SUCCESS"),
    neverSynced,
    lastRunAt: runs[0]?.startedAt ?? null,
    oldestSyncAt: oldest?.lastSyncedAt ?? null,
    recentRuns: runs,
    failures: failures.map((row) => ({
      name: row.name,
      username: row.leetcodeUsername,
      error: row.syncError,
      retryCount: row.retryCount,
    })),
  };
}

export async function setStudentActive(studentId: string, isActive: boolean): Promise<void> {
  await prisma.student.update({
    where: { id: studentId },
    // A disabled student keeps their history but leaves the standings entirely.
    data: { isActive, ...(isActive ? {} : { rank: null, previousRank: null }) },
  });
}

export async function deleteStudent(studentId: string): Promise<void> {
  // Cascades remove the profile, snapshots and solved problems with the student.
  await prisma.student.delete({ where: { id: studentId } });
}

/** Leaderboard export. Includes the college student ID, which the public views never do. */
export async function exportLeaderboardCsv(): Promise<string> {
  const settings = await getChallengeSettings();
  const students = await prisma.student.findMany({
    where: { isActive: true },
    orderBy: [{ challengeSolved: "desc" }, { challengePoints: "desc" }, { joinedAt: "asc" }],
    select: {
      rank: true,
      name: true,
      studentId: true,
      leetcodeUsername: true,
      challengeSolved: true,
      challengeEasy: true,
      challengeMedium: true,
      challengeHard: true,
      challengePoints: true,
      currentStreak: true,
      longestStreak: true,
      joinedAt: true,
      lastSyncedAt: true,
    },
  });

  const header = [
    "Rank",
    "Name",
    "Student ID",
    "LeetCode Username",
    "Challenge Solved",
    "Easy",
    "Medium",
    "Hard",
    "Points",
    "Current Streak",
    "Longest Streak",
    "Joined At",
    "Last Synced At",
  ];

  const lines = students.map((student, index) =>
    [
      student.rank ?? index + 1,
      student.name,
      student.studentId,
      student.leetcodeUsername,
      student.challengeSolved,
      student.challengeEasy,
      student.challengeMedium,
      student.challengeHard,
      student.challengePoints,
      student.currentStreak,
      student.longestStreak,
      student.joinedAt.toISOString(),
      student.lastSyncedAt?.toISOString() ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  const generatedAt = toDayKey(new Date(), settings.timezone);
  return [`# ${settings.challengeName} - exported ${generatedAt}`, header.join(","), ...lines].join(
    "\r\n",
  );
}

/**
 * Escapes a CSV cell.
 *
 * The leading apostrophe on cells starting with a formula character stops spreadsheet
 * software treating a student's name as a formula (CSV injection).
 */
function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export interface AdminOverviewExtras {
  solvedToday: number;
  demoStudents: number;
}

export async function getAdminExtras(now: Date = new Date()): Promise<AdminOverviewExtras> {
  const settings = await getChallengeSettings();
  const todayKey = toDayKey(now, settings.timezone);

  const [solvedToday, demoStudents] = await Promise.all([
    prisma.dailySnapshot.count({
      where: {
        student: { isActive: true },
        date: dayKeyToDateColumn(todayKey),
        solvedDelta: { gt: 0 },
      },
    }),
    prisma.student.count({ where: { isDemo: true } }),
  ]);

  return { solvedToday, demoStudents };
}
