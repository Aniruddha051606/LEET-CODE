import "server-only";


import { getChallengeSettings, scoringOf } from "@/lib/challenge/config";
import {
  addDays,
  challengeEndDayKey,
  challengePhase,
  challengeStartDayKey,
  dateColumnToDayKey,
  dayKeyToDateColumn,
  effectiveEndDayKey,
  maxDayKey,
  toDayKey,
} from "@/lib/challenge/dates";
import { progressFromBaseline, shouldLockBaseline, shouldRebaseBaseline } from "@/lib/challenge/progress";

import { computeStreaks } from "@/lib/challenge/streak";
import type {
  ActivityDay,
  Baseline,
  ChallengeSettings,
  DayKey,
  Difficulty,
  LifetimeStats,
} from "@/lib/challenge/types";
import { prisma } from "@/lib/db";
import { getLeetCodeProvider, isLeetCodeProviderError } from "@/lib/leetcode";
import { mapWithConcurrency } from "@/lib/leetcode/http";
import type { LeetCodeProfileData, LeetCodeProvider } from "@/lib/leetcode/types";

/**
 * Synchronisation.
 *
 * This module is the ONLY place that writes challenge standings. Everything it does is
 * idempotent: running it twice in a row produces exactly the same database state as
 * running it once.
 *
 *   - Daily rows are keyed on (studentId, date) and upserted, never inserted blindly.
 *   - Solved problems are keyed on (studentId, problemSlug) and inserted with
 *     `skipDuplicates`, so a re-solve or a re-run cannot double count.
 *   - Challenge totals are recomputed from the baseline each time rather than
 *     accumulated, so they cannot drift.
 *
 * When LeetCode cannot be reached the failure is recorded against the student and the
 * previous numbers are left untouched. Nothing is ever replaced with invented data.
 */

/** How many recent problem slugs we are willing to resolve to a difficulty per sync. */
const MAX_PROBLEM_LOOKUPS_PER_SYNC = 12;

/** How many trailing days of the submission calendar we refresh on a routine sync. */
const CALENDAR_REFRESH_DAYS = 14;

export type SyncTriggerName = "CRON" | "ADMIN" | "REGISTRATION" | "MANUAL";

export interface StudentSyncResult {
  studentId: string;
  username: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  challengeSolved?: number;
  challengePoints?: number;
  newProblems?: number;
  /** Safe for display: provider errors are already sanitised upstream. */
  error?: string;
}

export interface GlobalSyncSummary {
  syncRunId: string;
  trigger: SyncTriggerName;
  totalStudents: number;
  succeeded: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: StudentSyncResult[];
}

function clampToZero(value: number): number {
  return value > 0 ? value : 0;
}

function toDifficultyEnum(value: Difficulty): Difficulty {
  return value;
}

/**
 * Resolves difficulties for problem slugs, consulting the shared `Problem` cache first
 * so each problem is fetched from LeetCode once for the entire college.
 */
async function resolveDifficulties(
  slugs: readonly string[],
  provider: LeetCodeProvider,
): Promise<Map<string, { title: string; difficulty: Difficulty }>> {
  const resolved = new Map<string, { title: string; difficulty: Difficulty }>();
  if (slugs.length === 0) return resolved;

  const unique = [...new Set(slugs)];
  const known = await prisma.problem.findMany({ where: { slug: { in: unique } } });
  for (const problem of known) {
    resolved.set(problem.slug, { title: problem.title, difficulty: problem.difficulty });
  }

  const missing = unique.filter((slug) => !resolved.has(slug)).slice(0, MAX_PROBLEM_LOOKUPS_PER_SYNC);
  if (missing.length === 0) return resolved;

  const fetched = await mapWithConcurrency(missing, 3, async (slug) => {
    try {
      return await provider.getProblem(slug);
    } catch {
      // A difficulty we cannot resolve is recorded as null rather than guessed.
      return null;
    }
  });

  const rows = fetched.filter((meta): meta is NonNullable<typeof meta> => meta !== null);
  if (rows.length > 0) {
    await prisma.problem.createMany({
      data: rows.map((meta) => ({
        slug: meta.slug,
        title: meta.title,
        difficulty: toDifficultyEnum(meta.difficulty),
        questionId: meta.questionId,
      })),
      skipDuplicates: true,
    });
    for (const meta of rows) {
      resolved.set(meta.slug, { title: meta.title, difficulty: meta.difficulty });
    }
  }

  return resolved;
}

interface StudentRow {
  id: string;
  leetcodeUsername: string;
  isActive: boolean;
  isDemo: boolean;
  lastSyncedAt: Date | null;
  baselineTotalSolved: number;
  baselineEasySolved: number;
  baselineMediumSolved: number;
  baselineHardSolved: number;
  baselineLockedAt: Date | null;
}

const STUDENT_SELECT = {
  id: true,
  leetcodeUsername: true,
  isActive: true,
  isDemo: true,
  lastSyncedAt: true,
  baselineTotalSolved: true,
  baselineEasySolved: true,
  baselineMediumSolved: true,
  baselineHardSolved: true,
  baselineLockedAt: true,
} as const;

function lifetimeFromProfile(profile: LeetCodeProfileData): LifetimeStats {
  return {
    total: profile.totalSolved,
    easy: profile.easySolved,
    medium: profile.mediumSolved,
    hard: profile.hardSolved,
  };
}

/**
 * Synchronises one student.
 *
 * Throws only for programming errors; provider failures are captured and returned as a
 * FAILED result after being recorded on the student row.
 */
export async function syncStudent(
  studentId: string,
  options: { settings?: ChallengeSettings; provider?: LeetCodeProvider; now?: Date } = {},
): Promise<StudentSyncResult> {
  const settings = options.settings ?? (await getChallengeSettings());
  const provider = options.provider ?? getLeetCodeProvider();
  const now = options.now ?? new Date();

  const student = (await prisma.student.findUnique({
    where: { id: studentId },
    select: STUDENT_SELECT,
  })) as StudentRow | null;

  if (!student) {
    return { studentId, username: "", status: "SKIPPED", error: "Student not found" };
  }
  if (!student.isActive) {
    return {
      studentId,
      username: student.leetcodeUsername,
      status: "SKIPPED",
      error: "Student is disabled",
    };
  }
  // Seeded demo students hold invented usernames, so the real provider could only ever
  // fail on them. Skipping keeps the admin failure panel meaningful in a seeded
  // development database. The mock provider handles them fine, so it still syncs them.
  if (student.isDemo && provider.name !== "leetcode-mock") {
    return {
      studentId,
      username: student.leetcodeUsername,
      status: "SKIPPED",
      error: "Demo student is not backed by a real LeetCode profile",
    };
  }

  let profile: LeetCodeProfileData;
  try {
    profile = await provider.getProfile(student.leetcodeUsername);
  } catch (error) {
    const message = isLeetCodeProviderError(error) ? `${error.code}: ${error.message}` : "Unknown provider error";
    await prisma.student.update({
      where: { id: student.id },
      data: {
        syncStatus: "FAILED",
        syncError: message.slice(0, 500),
        retryCount: { increment: 1 },
        lastSyncedAt: now,
      },
    });
    return {
      studentId: student.id,
      username: student.leetcodeUsername,
      status: "FAILED",
      error: message,
    };
  }

  const scoring = scoringOf(settings);
  const phase = challengePhase(settings, now);
  const startDayKey = challengeStartDayKey(settings);
  const endDayKey = challengeEndDayKey(settings);
  const todayKey = toDayKey(now, settings.timezone);
  const current = lifetimeFromProfile(profile);

  // ---- Baseline handling -------------------------------------------------------
  // Before the challenge opens the baseline keeps moving forward, so pre-challenge work
  // is folded into it and can never be counted. It freezes at the first sync on or after
  // the start instant.
  const rebase = shouldRebaseBaseline(settings, student.baselineLockedAt, now);
  const lock = shouldLockBaseline(settings, student.baselineLockedAt, now);

  const baseline: Baseline = rebase
    ? { total: current.total, easy: current.easy, medium: current.medium, hard: current.hard }
    : {
        total: student.baselineTotalSolved,
        easy: student.baselineEasySolved,
        medium: student.baselineMediumSolved,
        hard: student.baselineHardSolved,
      };

  // ---- Recent problems (rolling window) ---------------------------------------
  let recentProblems: Awaited<ReturnType<LeetCodeProvider["getSolvedProblems"]>> = [];
  try {
    recentProblems = await provider.getSolvedProblems(student.leetcodeUsername);
  } catch {
    // The activity feed is a nice-to-have. Losing it must not fail the whole sync,
    // because the authoritative totals come from the profile counters we already have.
  }

  const inWindowProblems = recentProblems.filter(
    (item) =>
      item.solvedAt.getTime() >= settings.startDate.getTime() &&
      item.solvedAt.getTime() <= settings.endDate.getTime(),
  );

  const difficulties = await resolveDifficulties(
    inWindowProblems.map((item) => item.problemSlug),
    provider,
  );

  // ---- Submission calendar (heatmap detail) ------------------------------------
  const calendarDays = await fetchCalendarDays(student, settings, provider, now);

  // ---- Persist -----------------------------------------------------------------
  const result = await prisma.$transaction(async (tx) => {
    await tx.leetCodeProfile.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        profileUrl: profile.profileUrl,
        realName: profile.realName,
        avatarUrl: profile.avatarUrl,
        totalSolved: profile.totalSolved,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        totalSubmissions: profile.totalSubmissions,
        ranking: profile.ranking,
        reputation: profile.reputation,
        lastFetchedAt: profile.fetchedAt,
      },
      update: {
        profileUrl: profile.profileUrl,
        realName: profile.realName,
        avatarUrl: profile.avatarUrl,
        totalSolved: profile.totalSolved,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        totalSubmissions: profile.totalSubmissions,
        ranking: profile.ranking,
        reputation: profile.reputation,
        lastFetchedAt: profile.fetchedAt,
      },
    });

    // Newly detected solved problems. `skipDuplicates` plus the unique constraint on
    // (studentId, problemSlug) is what makes re-running the sync free of side effects.
    let newProblems = 0;
    if (inWindowProblems.length > 0) {
      const inserted = await tx.solvedProblem.createMany({
        data: inWindowProblems.map((item) => {
          const meta = difficulties.get(item.problemSlug);
          return {
            studentId: student.id,
            problemSlug: item.problemSlug,
            title: meta?.title ?? item.title,
            difficulty: meta?.difficulty ?? null,
            solvedAt: item.solvedAt,
            detectedAt: now,
            submissionId: item.submissionId,
          };
        }),
        skipDuplicates: true,
      });
      newProblems = inserted.count;
    }

    // Backfill difficulties that were unknown when the row was first written.
    for (const [slug, meta] of difficulties) {
      await tx.solvedProblem.updateMany({
        where: { studentId: student.id, problemSlug: slug, difficulty: null },
        data: { difficulty: meta.difficulty },
      });
    }

    // ---- Daily snapshot for today ----------------------------------------------
    if (phase === "ACTIVE") {
      const previous = await tx.dailySnapshot.findFirst({
        where: { studentId: student.id, date: { lt: dayKeyToDateColumn(todayKey) } },
        orderBy: { date: "desc" },
        select: { totalSolved: true, easySolved: true, mediumSolved: true, hardSolved: true },
      });

      const priorCumulative = previous ?? {
        totalSolved: baseline.total,
        easySolved: baseline.easy,
        mediumSolved: baseline.medium,
        hardSolved: baseline.hard,
      };

      const cumulativeProgress = progressFromBaseline(current, baseline, scoring);

      const snapshotData = {
        totalSolved: current.total,
        easySolved: current.easy,
        mediumSolved: current.medium,
        hardSolved: current.hard,
        solvedDelta: clampToZero(current.total - priorCumulative.totalSolved),
        easyDelta: clampToZero(current.easy - priorCumulative.easySolved),
        mediumDelta: clampToZero(current.medium - priorCumulative.mediumSolved),
        hardDelta: clampToZero(current.hard - priorCumulative.hardSolved),
        points: cumulativeProgress.points,
      };

      await tx.dailySnapshot.upsert({
        where: { studentId_date: { studentId: student.id, date: dayKeyToDateColumn(todayKey) } },
        create: { studentId: student.id, date: dayKeyToDateColumn(todayKey), ...snapshotData },
        update: snapshotData,
      });
    }

    // ---- Submission counts from the calendar ------------------------------------
    for (const day of calendarDays) {
      await tx.dailySnapshot.upsert({
        where: { studentId_date: { studentId: student.id, date: dayKeyToDateColumn(day.day) } },
        create: {
          studentId: student.id,
          date: dayKeyToDateColumn(day.day),
          submissions: day.submissions ?? 0,
        },
        update: { submissions: day.submissions ?? 0 },
      });
    }

    // ---- Recompute challenge standings from stored history ----------------------
    const snapshots = await tx.dailySnapshot.findMany({
      where: { studentId: student.id },
      orderBy: { date: "asc" },
      select: {
        date: true,
        solvedDelta: true,
        totalSolved: true,
        easySolved: true,
        mediumSolved: true,
        hardSolved: true,
      },
    });

    // While the challenge runs, the live profile is the truth. Once it has ended we
    // freeze on the last snapshot taken inside the window, so problems solved in
    // January can never change a December result.
    let effective: LifetimeStats = current;
    if (phase === "ENDED") {
      const lastInWindow = [...snapshots]
        .reverse()
        .find((snapshot) => dateColumnToDayKey(snapshot.date) <= endDayKey && snapshot.totalSolved > 0);
      if (lastInWindow) {
        effective = {
          total: lastInWindow.totalSolved,
          easy: lastInWindow.easySolved,
          medium: lastInWindow.mediumSolved,
          hard: lastInWindow.hardSolved,
        };
      }
    } else if (phase === "BEFORE") {
      effective = { total: baseline.total, easy: baseline.easy, medium: baseline.medium, hard: baseline.hard };
    }

    const progress = progressFromBaseline(effective, baseline, scoring);

    const activity: ActivityDay[] = snapshots.map((snapshot) => ({
      day: dateColumnToDayKey(snapshot.date),
      solved: snapshot.solvedDelta,
    }));

    const streaks = computeStreaks(activity, {
      startDayKey,
      endDayKey,
      todayDayKey: todayKey,
    });

    await tx.student.update({
      where: { id: student.id },
      data: {
        challengeSolved: progress.total,
        challengeEasy: progress.easy,
        challengeMedium: progress.medium,
        challengeHard: progress.hard,
        challengePoints: progress.points,
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
        baselineTotalSolved: baseline.total,
        baselineEasySolved: baseline.easy,
        baselineMediumSolved: baseline.medium,
        baselineHardSolved: baseline.hard,
        ...(rebase ? { baselineCapturedAt: now } : {}),
        ...(lock ? { baselineLockedAt: now } : {}),
        lastFetchedAt: profile.fetchedAt,
        lastSyncedAt: now,
        syncStatus: "SUCCESS" as const,
        syncError: null,
        retryCount: 0,
      },
    });

    return {
      challengeSolved: progress.total,
      challengePoints: progress.points,
      newProblems,
    };
  });

  return {
    studentId: student.id,
    username: student.leetcodeUsername,
    status: "SUCCESS",
    ...result,
  };
}

/**
 * Pulls the submission calendar and maps LeetCode's midnight-UTC keys onto challenge
 * days. On a student's first sync the whole window is backfilled; afterwards only the
 * trailing fortnight is refreshed, which keeps routine syncs to a handful of writes.
 */
async function fetchCalendarDays(
  student: StudentRow,
  settings: ChallengeSettings,
  provider: LeetCodeProvider,
  now: Date,
): Promise<ActivityDay[]> {
  const startDayKey = challengeStartDayKey(settings);
  const lastDayKey = effectiveEndDayKey(settings, now);
  if (lastDayKey < startDayKey) return [];

  const firstDayKey = student.lastSyncedAt === null
    ? startDayKey
    : maxDayKey(startDayKey, addDays(lastDayKey, -(CALENDAR_REFRESH_DAYS - 1)));

  const years = new Set<number>([
    Number(startDayKey.slice(0, 4)),
    Number(lastDayKey.slice(0, 4)),
  ]);

  const byDay = new Map<DayKey, number>();
  for (const year of years) {
    try {
      const days = await provider.getRecentActivity(student.leetcodeUsername, year);
      for (const entry of days) {
        // LeetCode keys the calendar at midnight UTC. Converting that instant into the
        // challenge timezone is what keeps the heatmap aligned with challenge days.
        const day = toDayKey(entry.instant, settings.timezone);
        if (day < firstDayKey || day > lastDayKey) continue;
        byDay.set(day, (byDay.get(day) ?? 0) + entry.submissions);
      }
    } catch {
      // Calendar data is supplementary; its absence must not fail the sync.
    }
  }

  return [...byDay.entries()].map(([day, submissions]) => ({ day, solved: 0, submissions }));
}

/**
 * Recomputes every rank in one statement.
 *
 * A window function keeps this O(1) round trips no matter how many students there are,
 * and `RANK()` gives ties the same rank with the next rank skipped, matching
 * `compareForRank` in `src/lib/challenge/ranking.ts`. `previousRank` is only disturbed
 * when a rank actually moves, so the movement arrows stay meaningful.
 */
export async function recomputeRanks(): Promise<void> {
  await prisma.$executeRaw`
    WITH ranked AS (
      SELECT
        id,
        RANK() OVER (
          ORDER BY "challengeSolved" DESC, "challengePoints" DESC
        ) AS new_rank
      FROM "Student"
      WHERE "isActive" = true
    )
    UPDATE "Student" AS s
    SET "previousRank" = s."rank",
        "rank" = ranked.new_rank
    FROM ranked
    WHERE s.id = ranked.id
      AND s."rank" IS DISTINCT FROM ranked.new_rank
  `;

  // Disabled students keep their history but drop out of the standings.
  await prisma.student.updateMany({
    where: { isActive: false, rank: { not: null } },
    data: { rank: null },
  });
}

export interface GlobalSyncOptions {
  trigger: SyncTriggerName;
  /**
   * Maximum students to process in this run, stalest first. Global syncs are chunked so
   * a single invocation stays inside serverless time limits; the hourly cron works
   * through the college over successive runs.
   */
  limit?: number;
  concurrency?: number;
  now?: Date;
}

export async function syncAllStudents(options: GlobalSyncOptions): Promise<GlobalSyncSummary> {
  const startedAt = options.now ?? new Date();
  const settings = await getChallengeSettings();
  const provider = getLeetCodeProvider();
  const limit = options.limit ?? 200;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8));

  const run = await prisma.syncRun.create({
    data: { trigger: options.trigger, startedAt },
  });

  // Stalest first, and never-synced students before everyone else. Demo rows are left
  // out against the real provider so they cannot consume a batch slot.
  const syncsDemoStudents = provider.name === "leetcode-mock";
  const students = await prisma.student.findMany({
    where: { isActive: true, ...(syncsDemoStudents ? {} : { isDemo: false }) },
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true },
  });

  const results = await mapWithConcurrency(students, concurrency, async ({ id }) => {
    try {
      return await syncStudent(id, { settings, provider, now: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected sync error";
      return {
        studentId: id,
        username: "",
        status: "FAILED" as const,
        error: message,
      };
    }
  });

  if (results.some((result) => result.status === "SUCCESS")) {
    await recomputeRanks();
  }

  const succeeded = results.filter((result) => result.status === "SUCCESS").length;
  const failed = results.filter((result) => result.status === "FAILED").length;
  const skipped = results.filter((result) => result.status === "SKIPPED").length;
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      durationMs,
      totalStudents: students.length,
      succeeded,
      failed,
    },
  });

  return {
    syncRunId: run.id,
    trigger: options.trigger,
    totalStudents: students.length,
    succeeded,
    failed,
    skipped,
    durationMs,
    results,
  };
}

/** Convenience used by the registration flow and the admin "refresh now" button. */
export async function syncStudentAndRerank(studentId: string): Promise<StudentSyncResult> {
  const result = await syncStudent(studentId);
  if (result.status === "SUCCESS") {
    await recomputeRanks();
  }
  return result;
}

