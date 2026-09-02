/**
 * Domain types for the challenge.
 *
 * These deliberately do NOT import from the generated Prisma client so that the
 * business logic stays pure and unit-testable without a database or codegen step.
 * The string values match the Prisma enums exactly, so conversion is a plain cast.
 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export const DIFFICULTIES: readonly Difficulty[] = ["EASY", "MEDIUM", "HARD"] as const;

/** A calendar day in the challenge timezone, formatted `YYYY-MM-DD`. */
export type DayKey = string;

/** Per-difficulty counts. Used for both lifetime totals and challenge deltas. */
export interface DifficultyCounts {
  easy: number;
  medium: number;
  hard: number;
}

/** Lifetime totals as reported by LeetCode. Never used directly for ranking. */
export interface LifetimeStats extends DifficultyCounts {
  total: number;
}

/** The stats a student had when the challenge started for them. */
export interface Baseline extends DifficultyCounts {
  total: number;
}

/** Problems solved *during* the challenge, plus the points they earned. */
export interface ChallengeProgress extends DifficultyCounts {
  total: number;
  points: number;
}

/** How points are awarded. Stored in the database so an admin can change it. */
export interface ScoringConfig {
  easyPoints: number;
  mediumPoints: number;
  hardPoints: number;
}

/** The challenge window. `startDate`/`endDate` are absolute UTC instants. */
export interface ChallengeWindow {
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export interface ChallengeSettings extends ChallengeWindow, ScoringConfig {
  challengeName: string;
}

/** A problem solved at a known instant. */
export interface SolvedAt {
  problemSlug: string;
  difficulty: Difficulty | null;
  solvedAt: Date;
}

/** One challenge day's activity for a student. */
export interface ActivityDay {
  day: DayKey;
  solved: number;
  submissions?: number;
}
