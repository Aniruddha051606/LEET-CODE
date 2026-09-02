import "server-only";

import { getChallengeSettings } from "@/lib/challenge/config";
import {
  addDays,
  challengeStartDayKey,
  dayKeyToDateColumn,
  effectiveEndDayKey,
  maxDayKey,
} from "@/lib/challenge/dates";
import { rankChange, type RankMovement } from "@/lib/challenge/ranking";
import { prisma } from "@/lib/db";

/**
 * Leaderboard reads.
 *
 * Every figure here comes out of the database. Opening the leaderboard makes zero
 * LeetCode requests no matter how many students are registered — synchronisation is a
 * completely separate background concern.
 *
 * Nothing in the returned shape exposes a database id or a college student ID; the
 * public identifier is the LeetCode username, which is public information already.
 */

export type LeaderboardSort = "RANK" | "SOLVED" | "POINTS" | "STREAK" | "NAME";

export interface LeaderboardRow {
  rank: number | null;
  movement: RankMovement;
  movementDelta: number;
  name: string;
  username: string;
  avatarUrl: string | null;
  initials: string;
  challengeSolved: number;
  easy: number;
  medium: number;
  hard: number;
  currentStreak: number;
  points: number;
}

export interface LeaderboardPage {
  rows: LeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeaderboardQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: LeaderboardSort;
}

const MAX_PAGE_SIZE = 100;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function orderFor(sort: LeaderboardSort) {
  switch (sort) {
    case "SOLVED":
      return [{ challengeSolved: "desc" as const }, { challengePoints: "desc" as const }];
    case "POINTS":
      return [{ challengePoints: "desc" as const }, { challengeSolved: "desc" as const }];
    case "STREAK":
      return [{ currentStreak: "desc" as const }, { challengeSolved: "desc" as const }];
    case "NAME":
      return [{ name: "asc" as const }];
    case "RANK":
    default:
      // The stored rank mirrors the same ordering, with never-ranked students last.
      return [
        { challengeSolved: "desc" as const },
        { challengePoints: "desc" as const },
        { joinedAt: "asc" as const },
      ];
  }
}

export async function getLeaderboard(query: LeaderboardQuery = {}): Promise<LeaderboardPage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize ?? 25)));
  const search = query.search?.trim();

  const where = {
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { leetcodeUsername: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: orderFor(query.sort ?? "RANK"),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        name: true,
        leetcodeUsername: true,
        rank: true,
        previousRank: true,
        challengeSolved: true,
        challengeEasy: true,
        challengeMedium: true,
        challengeHard: true,
        challengePoints: true,
        currentStreak: true,
        profile: { select: { avatarUrl: true } },
      },
    }),
  ]);

  const rows: LeaderboardRow[] = students.map((student) => {
    const change = rankChange(student.rank, student.previousRank);
    return {
      rank: student.rank,
      movement: change.movement,
      movementDelta: change.delta,
      name: student.name,
      username: student.leetcodeUsername,
      avatarUrl: student.profile?.avatarUrl ?? null,
      initials: initialsOf(student.name),
      challengeSolved: student.challengeSolved,
      easy: student.challengeEasy,
      medium: student.challengeMedium,
      hard: student.challengeHard,
      currentStreak: student.currentStreak,
      points: student.challengePoints,
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface PeriodRankEntry {
  username: string;
  solved: number;
  rank: number;
}

/**
 * Weekly and monthly standings, aggregated from stored daily activity rather than kept
 * as another denormalised column. These are secondary views; the challenge rank is the
 * one that counts.
 */
async function periodRanks(fromDay: string, toDay: string): Promise<PeriodRankEntry[]> {
  if (fromDay > toDay) return [];

  const grouped = await prisma.dailySnapshot.groupBy({
    by: ["studentId"],
    where: {
      date: { gte: dayKeyToDateColumn(fromDay), lte: dayKeyToDateColumn(toDay) },
      student: { isActive: true },
    },
    _sum: { solvedDelta: true },
  });

  const withTotals = grouped
    .map((row) => ({ studentId: row.studentId, solved: row._sum.solvedDelta ?? 0 }))
    .filter((row) => row.solved > 0)
    .sort((a, b) => b.solved - a.solved);

  if (withTotals.length === 0) return [];

  const students = await prisma.student.findMany({
    where: { id: { in: withTotals.map((row) => row.studentId) } },
    select: { id: true, leetcodeUsername: true },
  });
  const usernameById = new Map(students.map((student) => [student.id, student.leetcodeUsername]));

  let lastSolved: number | null = null;
  let lastRank = 0;

  return withTotals.map((row, index) => {
    if (lastSolved === null || row.solved !== lastSolved) {
      lastRank = index + 1;
      lastSolved = row.solved;
    }
    return {
      username: usernameById.get(row.studentId) ?? "",
      solved: row.solved,
      rank: lastRank,
    };
  });
}

export interface PeriodRanks {
  weekly: PeriodRankEntry[];
  monthly: PeriodRankEntry[];
}

export async function getPeriodRanks(now: Date = new Date()): Promise<PeriodRanks> {
  const settings = await getChallengeSettings();
  const startDay = challengeStartDayKey(settings);
  const today = effectiveEndDayKey(settings, now);

  const [weekly, monthly] = await Promise.all([
    periodRanks(maxDayKey(startDay, addDays(today, -6)), today),
    periodRanks(maxDayKey(startDay, `${today.slice(0, 7)}-01`), today),
  ]);

  return { weekly, monthly };
}

/** Rank of one student within a precomputed period listing. */
export function rankWithin(entries: readonly PeriodRankEntry[], username: string): number | null {
  return entries.find((entry) => entry.username === username)?.rank ?? null;
}
