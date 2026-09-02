import "server-only";

import { getChallengeSettings, scoringOf } from "@/lib/challenge/config";
import {
  challengeEndDayKey,
  challengeMonths,
  challengeStartDayKey,
  challengeTimeline,
  dateColumnToDayKey,
  dayKeyToDateColumn,
  effectiveEndDayKey,
  toDayKey,
  type ChallengeTimeline,
} from "@/lib/challenge/dates";
import { computePoints } from "@/lib/challenge/scoring";
import { busiestDay, densifyActivity } from "@/lib/challenge/streak";
import type { ActivityDay, ChallengeSettings } from "@/lib/challenge/types";
import { prisma } from "@/lib/db";

import { initialsOf } from "./leaderboard";

/**
 * College-wide statistics for the landing page, the challenge overview and the admin
 * dashboard. All of it is aggregated from stored snapshots, never from live LeetCode calls.
 */

export interface LeaderSummary {
  name: string;
  username: string;
  initials: string;
  solved: number;
  points: number;
}

export interface DailyPoint {
  day: string;
  solved: number;
  /** Number of students who solved at least one problem that day. */
  activeStudents: number;
}

export interface WeeklyPoint {
  label: string;
  startDay: string;
  solved: number;
}

export interface MonthlyTotal {
  key: string;
  label: string;
  solved: number;
  points: number;
  started: boolean;
}

export interface ChallengeOverview {
  settings: ChallengeSettings;
  timeline: ChallengeTimeline;

  participants: number;
  activeParticipants: number;
  solvedToday: number;

  totalSolved: number;
  totalPoints: number;
  averagePerStudent: number;

  difficultyTotals: { easy: number; medium: number; hard: number };
  mostActiveDay: { day: string; solved: number } | null;
  longestStreak: { value: number; name: string; username: string } | null;
  leader: LeaderSummary | null;

  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  monthly: MonthlyTotal[];
}

/** Small summary used by the landing page hero. */
export interface ChallengeSummary {
  settings: ChallengeSettings;
  timeline: ChallengeTimeline;
  participants: number;
  totalSolved: number;
  leader: LeaderSummary | null;
}

export async function getChallengeSummary(now: Date = new Date()): Promise<ChallengeSummary> {
  const settings = await getChallengeSettings();

  const [participants, totals, leaderRow] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.student.aggregate({
      where: { isActive: true },
      _sum: { challengeSolved: true },
    }),
    topStudent(),
  ]);

  return {
    settings,
    timeline: challengeTimeline(settings, now),
    participants,
    totalSolved: totals._sum.challengeSolved ?? 0,
    leader: leaderRow,
  };
}

async function topStudent(): Promise<LeaderSummary | null> {
  const row = await prisma.student.findFirst({
    where: { isActive: true, challengeSolved: { gt: 0 } },
    orderBy: [{ challengeSolved: "desc" }, { challengePoints: "desc" }, { joinedAt: "asc" }],
    select: {
      name: true,
      leetcodeUsername: true,
      challengeSolved: true,
      challengePoints: true,
    },
  });

  if (!row) return null;
  return {
    name: row.name,
    username: row.leetcodeUsername,
    initials: initialsOf(row.name),
    solved: row.challengeSolved,
    points: row.challengePoints,
  };
}

export async function getChallengeOverview(now: Date = new Date()): Promise<ChallengeOverview> {
  const settings = await getChallengeSettings();
  const timeline = challengeTimeline(settings, now);
  const startDay = challengeStartDayKey(settings);
  const endDay = challengeEndDayKey(settings);
  const lastDay = effectiveEndDayKey(settings, now);
  const todayKey = toDayKey(now, settings.timezone);
  const scoring = scoringOf(settings);

  const [participants, activeParticipants, totals, dailyGroups, leader, streakRow, solvedTodayRows] =
    await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      // "Active" means they have actually solved something during the challenge.
      prisma.student.count({ where: { isActive: true, challengeSolved: { gt: 0 } } }),
      prisma.student.aggregate({
        where: { isActive: true },
        _sum: {
          challengeSolved: true,
          challengePoints: true,
          challengeEasy: true,
          challengeMedium: true,
          challengeHard: true,
        },
      }),
      prisma.dailySnapshot.groupBy({
        by: ["date"],
        where: {
          student: { isActive: true },
          date: { gte: dayKeyToDateColumn(startDay), lte: dayKeyToDateColumn(endDay) },
        },
        _sum: { solvedDelta: true, easyDelta: true, mediumDelta: true, hardDelta: true },
      }),
      topStudent(),
      prisma.student.findFirst({
        where: { isActive: true, longestStreak: { gt: 0 } },
        orderBy: { longestStreak: "desc" },
        select: { longestStreak: true, name: true, leetcodeUsername: true },
      }),
      prisma.dailySnapshot.count({
        where: {
          student: { isActive: true },
          date: dayKeyToDateColumn(todayKey),
          solvedDelta: { gt: 0 },
        },
      }),
    ]);

  const activeCountByDay = await prisma.dailySnapshot.groupBy({
    by: ["date"],
    where: {
      student: { isActive: true },
      solvedDelta: { gt: 0 },
      date: { gte: dayKeyToDateColumn(startDay), lte: dayKeyToDateColumn(endDay) },
    },
    _count: { _all: true },
  });
  const activeByDay = new Map(
    activeCountByDay.map((row) => [dateColumnToDayKey(row.date), row._count._all]),
  );

  const dayTotals = new Map(
    dailyGroups.map((row) => [
      dateColumnToDayKey(row.date),
      {
        solved: row._sum.solvedDelta ?? 0,
        easy: row._sum.easyDelta ?? 0,
        medium: row._sum.mediumDelta ?? 0,
        hard: row._sum.hardDelta ?? 0,
      },
    ]),
  );

  const activityRows: ActivityDay[] = [...dayTotals.entries()].map(([day, value]) => ({
    day,
    solved: value.solved,
  }));

  // Only chart up to today: a flat line stretching into December reads as failure
  // rather than as "not happened yet".
  const daily: DailyPoint[] = densifyActivity(activityRows, startDay, lastDay).map((entry) => ({
    day: entry.day,
    solved: entry.solved,
    activeStudents: activeByDay.get(entry.day) ?? 0,
  }));

  const weekly: WeeklyPoint[] = [];
  for (let index = 0; index < daily.length; index += 7) {
    const chunk = daily.slice(index, index + 7);
    const first = chunk[0];
    if (!first) continue;
    weekly.push({
      label: `Week ${Math.floor(index / 7) + 1}`,
      startDay: first.day,
      solved: chunk.reduce((total, point) => total + point.solved, 0),
    });
  }

  const monthly: MonthlyTotal[] = challengeMonths(settings).map((month) => {
    let solved = 0;
    let easy = 0;
    let medium = 0;
    let hard = 0;
    for (const [day, value] of dayTotals) {
      if (day < month.firstDay || day > month.lastDay) continue;
      solved += value.solved;
      easy += value.easy;
      medium += value.medium;
      hard += value.hard;
    }
    return {
      key: month.key,
      label: month.label,
      solved,
      points: computePoints({ easy, medium, hard }, scoring),
      started: month.firstDay <= lastDay,
    };
  });

  const totalSolved = totals._sum.challengeSolved ?? 0;

  return {
    settings,
    timeline,
    participants,
    activeParticipants,
    solvedToday: solvedTodayRows,
    totalSolved,
    totalPoints: totals._sum.challengePoints ?? 0,
    averagePerStudent: participants === 0 ? 0 : Math.round((totalSolved / participants) * 10) / 10,
    difficultyTotals: {
      easy: totals._sum.challengeEasy ?? 0,
      medium: totals._sum.challengeMedium ?? 0,
      hard: totals._sum.challengeHard ?? 0,
    },
    mostActiveDay: busiestDay(activityRows),
    longestStreak: streakRow
      ? {
          value: streakRow.longestStreak,
          name: streakRow.name,
          username: streakRow.leetcodeUsername,
        }
      : null,
    leader,
    daily,
    weekly,
    monthly,
  };
}
