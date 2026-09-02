import "server-only";

import { getChallengeSettings, scoringOf } from "@/lib/challenge/config";
import {
  addDays,
  challengeEndDayKey,
  challengeMonths,
  challengeStartDayKey,

  dateColumnToDayKey,
  dayKeyToDateColumn,
  effectiveEndDayKey,
  maxDayKey,
  toDayKey,
} from "@/lib/challenge/dates";
import { gapToNextRank, topPercentile, type RankMovement } from "@/lib/challenge/ranking";
import { rankChange } from "@/lib/challenge/ranking";
import { computePoints } from "@/lib/challenge/scoring";
import { densifyActivity } from "@/lib/challenge/streak";
import type { ActivityDay, ChallengeSettings, Difficulty } from "@/lib/challenge/types";
import { prisma } from "@/lib/db";

import { getPeriodRanks, initialsOf, rankWithin } from "./leaderboard";

/**
 * Everything the student dashboard renders, assembled from stored data in one place.
 * The page component does no arithmetic beyond formatting.
 */

export interface MonthlyProgressEntry {
  key: string;
  label: string;
  solved: number;
  points: number;
  easy: number;
  medium: number;
  hard: number;
  /** False for months the challenge has not reached yet. */
  started: boolean;
}

export interface RecentSolve {
  slug: string;
  title: string;
  difficulty: Difficulty | null;
  solvedAt: Date;
  url: string;
}

export interface SyncState {
  status: "PENDING" | "SUCCESS" | "FAILED";
  lastSyncedAt: Date | null;
  lastFetchedAt: Date | null;
  hasError: boolean;
}

export interface StudentDashboard {
  name: string;
  username: string;
  initials: string;
  profileUrl: string;
  avatarUrl: string | null;
  joinedAt: Date;

  rank: number | null;
  previousRank: number | null;
  movement: RankMovement;
  movementDelta: number;
  totalParticipants: number;
  percentile: number | null;
  weeklyRank: number | null;
  monthlyRank: number | null;

  challenge: {
    solved: number;
    easy: number;
    medium: number;
    hard: number;
    points: number;
  };
  lifetime: {
    total: number;
    easy: number;
    medium: number;
    hard: number;
    globalRanking: number | null;
  };
  streaks: { current: number; longest: number };

  activity: ActivityDay[];
  monthly: MonthlyProgressEntry[];
  recent: RecentSolve[];
  sync: SyncState;

  /** Real, derived encouragement. Nothing here is invented. */
  motivation: string[];

  settings: ChallengeSettings;
}

export async function getStudentDashboard(
  username: string,
  now: Date = new Date(),
): Promise<StudentDashboard | null> {
  const settings = await getChallengeSettings();
  const usernameKey = username.trim().toLowerCase();

  const student = await prisma.student.findUnique({
    where: { usernameKey },
    select: {
      id: true,
      name: true,
      leetcodeUsername: true,
      joinedAt: true,
      isActive: true,
      rank: true,
      previousRank: true,
      challengeSolved: true,
      challengeEasy: true,
      challengeMedium: true,
      challengeHard: true,
      challengePoints: true,
      currentStreak: true,
      longestStreak: true,
      syncStatus: true,
      syncError: true,
      lastSyncedAt: true,
      lastFetchedAt: true,
      profile: {
        select: {
          profileUrl: true,
          avatarUrl: true,
          totalSolved: true,
          easySolved: true,
          mediumSolved: true,
          hardSolved: true,
          ranking: true,
        },
      },
    },
  });

  if (!student || !student.isActive) return null;

  const startDay = challengeStartDayKey(settings);
  const endDay = challengeEndDayKey(settings);
  const lastDay = effectiveEndDayKey(settings, now);
  const todayKey = toDayKey(now, settings.timezone);

  const [snapshots, recentRows, totalParticipants, periods, aboveRow] = await Promise.all([
    prisma.dailySnapshot.findMany({
      where: {
        studentId: student.id,
        date: { gte: dayKeyToDateColumn(startDay), lte: dayKeyToDateColumn(endDay) },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        solvedDelta: true,
        easyDelta: true,
        mediumDelta: true,
        hardDelta: true,
        submissions: true,
      },
    }),
    prisma.solvedProblem.findMany({
      where: {
        studentId: student.id,
        solvedAt: { gte: settings.startDate, lte: settings.endDate },
      },
      orderBy: { solvedAt: "desc" },
      take: 12,
      select: { problemSlug: true, title: true, difficulty: true, solvedAt: true },
    }),
    prisma.student.count({ where: { isActive: true } }),
    getPeriodRanks(now),
    // The student directly above on the leaderboard, for the "catch up" nudge.
    prisma.student.findFirst({
      where: {
        isActive: true,
        NOT: { id: student.id },
        OR: [
          { challengeSolved: { gt: student.challengeSolved } },
          {
            challengeSolved: student.challengeSolved,
            challengePoints: { gt: student.challengePoints },
          },
        ],
      },
      orderBy: [{ challengeSolved: "asc" }, { challengePoints: "asc" }],
      select: { challengeSolved: true, challengePoints: true },
    }),
  ]);

  const activityRows: ActivityDay[] = snapshots.map((snapshot) => ({
    day: dateColumnToDayKey(snapshot.date),
    solved: snapshot.solvedDelta,
    submissions: snapshot.submissions,
  }));

  const activity = densifyActivity(activityRows, startDay, endDay);
  const scoring = scoringOf(settings);

  const monthly: MonthlyProgressEntry[] = challengeMonths(settings).map((month) => {
    const within = snapshots.filter((snapshot) => {
      const day = dateColumnToDayKey(snapshot.date);
      return day >= month.firstDay && day <= month.lastDay;
    });
    const easy = sum(within.map((row) => row.easyDelta));
    const medium = sum(within.map((row) => row.mediumDelta));
    const hard = sum(within.map((row) => row.hardDelta));
    return {
      key: month.key,
      label: month.label,
      solved: sum(within.map((row) => row.solvedDelta)),
      points: computePoints({ easy, medium, hard }, scoring),
      easy,
      medium,
      hard,
      started: month.firstDay <= lastDay,
    };
  });

  const percentile = student.rank !== null ? topPercentile(student.rank, totalParticipants) : null;
  const change = rankChange(student.rank, student.previousRank);

  const motivation = buildMotivation({
    rank: student.rank,
    totalParticipants,
    percentile,
    currentStreak: student.currentStreak,
    challengeSolved: student.challengeSolved,
    challengePoints: student.challengePoints,
    above: aboveRow,
    snapshots: activityRows,
    todayKey,
    startDay,
  });

  return {
    name: student.name,
    username: student.leetcodeUsername,
    initials: initialsOf(student.name),
    profileUrl: student.profile?.profileUrl ?? `https://leetcode.com/u/${student.leetcodeUsername}/`,
    avatarUrl: student.profile?.avatarUrl ?? null,
    joinedAt: student.joinedAt,

    rank: student.rank,
    previousRank: student.previousRank,
    movement: change.movement,
    movementDelta: change.delta,
    totalParticipants,
    percentile,
    weeklyRank: rankWithin(periods.weekly, student.leetcodeUsername),
    monthlyRank: rankWithin(periods.monthly, student.leetcodeUsername),

    challenge: {
      solved: student.challengeSolved,
      easy: student.challengeEasy,
      medium: student.challengeMedium,
      hard: student.challengeHard,
      points: student.challengePoints,
    },
    lifetime: {
      total: student.profile?.totalSolved ?? 0,
      easy: student.profile?.easySolved ?? 0,
      medium: student.profile?.mediumSolved ?? 0,
      hard: student.profile?.hardSolved ?? 0,
      globalRanking: student.profile?.ranking ?? null,
    },
    streaks: { current: student.currentStreak, longest: student.longestStreak },

    activity,
    monthly,
    recent: recentRows.map((row) => ({
      slug: row.problemSlug,
      title: row.title,
      difficulty: row.difficulty,
      solvedAt: row.solvedAt,
      url: `https://leetcode.com/problems/${row.problemSlug}/`,
    })),
    sync: {
      status: student.syncStatus,
      lastSyncedAt: student.lastSyncedAt,
      lastFetchedAt: student.lastFetchedAt,
      hasError: student.syncStatus === "FAILED",
    },

    motivation,
    settings,
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function solvedBetween(activity: readonly ActivityDay[], from: string, to: string): number {
  return sum(activity.filter((day) => day.day >= from && day.day <= to).map((day) => day.solved));
}

interface MotivationInput {
  rank: number | null;
  totalParticipants: number;
  percentile: number | null;
  currentStreak: number;
  challengeSolved: number;
  challengePoints: number;
  above: { challengeSolved: number; challengePoints: number } | null;
  snapshots: readonly ActivityDay[];
  todayKey: string;
  startDay: string;
}

/**
 * Motivational lines, every one of them computed from real stored activity. If a fact
 * is not true for this student, the line is simply not shown.
 */
function buildMotivation(input: MotivationInput): string[] {
  const lines: string[] = [];

  if (input.rank !== null && input.totalParticipants > 1) {
    lines.push(`You're #${input.rank} of ${input.totalParticipants} in your college.`);
  }

  if (input.above !== null && input.rank !== null && input.rank > 1) {
    const needed = gapToNextRank(
      { challengeSolved: input.challengeSolved, challengePoints: input.challengePoints },
      input.above,
    );
    if (needed !== null && needed > 0) {
      lines.push(
        `${needed} more ${needed === 1 ? "problem" : "problems"} to overtake #${input.rank - 1}.`,
      );
    }
  }

  if (input.currentStreak >= 2) {
    lines.push(`${input.currentStreak} day streak. Keep it alive.`);
  }

  const thisWeekStart = maxDayKey(input.startDay, addDays(input.todayKey, -6));
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const lastWeekStart = maxDayKey(input.startDay, addDays(lastWeekEnd, -6));

  if (lastWeekEnd >= input.startDay) {
    const thisWeek = solvedBetween(input.snapshots, thisWeekStart, input.todayKey);
    const lastWeek = solvedBetween(input.snapshots, lastWeekStart, lastWeekEnd);
    const difference = thisWeek - lastWeek;
    if (difference > 0) {
      lines.push(
        `You solved ${difference} more ${difference === 1 ? "problem" : "problems"} this week than last week.`,
      );
    }
  }

  if (input.percentile !== null && input.percentile <= 25 && input.totalParticipants >= 4) {
    lines.push(`You're in the top ${input.percentile}%.`);
  }

  return lines;
}
