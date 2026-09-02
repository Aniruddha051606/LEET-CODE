/**
 * Challenge scoring.
 *
 * The point values live in the `ChallengeConfig` row, not in this file and definitely
 * not in the frontend. Everything that needs a score calls through here, so changing
 * the configuration in the admin panel changes every score in the product at once.
 */

import type { Difficulty, DifficultyCounts, ScoringConfig } from "./types";

/** Applied when the database has no configuration row yet. */
export const DEFAULT_SCORING: ScoringConfig = {
  easyPoints: 1,
  mediumPoints: 3,
  hardPoints: 5,
};

export function pointsForDifficulty(difficulty: Difficulty, scoring: ScoringConfig): number {
  switch (difficulty) {
    case "EASY":
      return scoring.easyPoints;
    case "MEDIUM":
      return scoring.mediumPoints;
    case "HARD":
      return scoring.hardPoints;
  }
}

/**
 * Points for a set of per-difficulty counts.
 *
 * Example with the default configuration: 10 easy + 5 medium + 2 hard
 * = (10 x 1) + (5 x 3) + (2 x 5) = 35.
 */
export function computePoints(counts: DifficultyCounts, scoring: ScoringConfig): number {
  return (
    counts.easy * scoring.easyPoints +
    counts.medium * scoring.mediumPoints +
    counts.hard * scoring.hardPoints
  );
}

/** Total problems represented by a set of counts. */
export function totalOf(counts: DifficultyCounts): number {
  return counts.easy + counts.medium + counts.hard;
}

/** Tallies a list of difficulties into counts. Unknown difficulties are ignored. */
export function tallyDifficulties(difficulties: ReadonlyArray<Difficulty | null>): DifficultyCounts {
  const counts: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const difficulty of difficulties) {
    if (difficulty === "EASY") counts.easy += 1;
    else if (difficulty === "MEDIUM") counts.medium += 1;
    else if (difficulty === "HARD") counts.hard += 1;
  }
  return counts;
}

/** Validates an admin-supplied scoring configuration. */
export function isValidScoring(scoring: ScoringConfig): boolean {
  return (
    [scoring.easyPoints, scoring.mediumPoints, scoring.hardPoints].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 1000,
    )
  );
}
