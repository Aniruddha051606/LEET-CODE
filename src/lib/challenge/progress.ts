/**
 * Challenge progress: how many problems a student solved *during* the challenge.
 *
 * There are two independent sources, and they are used for different things:
 *
 *  1. `progressFromBaseline` - authoritative. LeetCode's `acSubmissionNum` reports the
 *     number of DISTINCT problems solved per difficulty, so subtracting the baseline
 *     captured when the challenge started gives exactly the problems solved since.
 *     Because the underlying counter is distinct-problem based, re-solving a problem
 *     can never inflate it.
 *
 *  2. `progressFromProblems` - derived from stored `SolvedProblem` rows filtered to the
 *     challenge window. LeetCode only exposes the last 20 accepted submissions, so this
 *     view is necessarily incomplete and is used for the activity feed, per-day detail
 *     and tests, not for ranking.
 *
 * Both clamp at zero: LeetCode occasionally retires problems, which can make a lifetime
 * counter go *down*, and a negative contribution to a leaderboard would be nonsense.
 */

import { isWithinChallenge } from "./dates";
import { computePoints } from "./scoring";
import type {
  Baseline,
  ChallengeProgress,
  ChallengeWindow,
  DifficultyCounts,
  LifetimeStats,
  ScoringConfig,
  SolvedAt,
} from "./types";

function atLeastZero(value: number): number {
  return value > 0 ? value : 0;
}

export const ZERO_COUNTS: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };

/**
 * The authoritative calculation: current lifetime stats minus the stored baseline.
 *
 * Note `total` is recomputed from the per-difficulty deltas rather than taken from
 * `total - baseline.total`. The two agree in practice, but deriving it keeps `total`
 * consistent with the difficulty breakdown that produced the points.
 */
export function progressFromBaseline(
  current: LifetimeStats,
  baseline: Baseline,
  scoring: ScoringConfig,
): ChallengeProgress {
  const counts: DifficultyCounts = {
    easy: atLeastZero(current.easy - baseline.easy),
    medium: atLeastZero(current.medium - baseline.medium),
    hard: atLeastZero(current.hard - baseline.hard),
  };

  return {
    ...counts,
    total: counts.easy + counts.medium + counts.hard,
    points: computePoints(counts, scoring),
  };
}

/** Keeps only the problems solved inside the challenge window. */
export function filterWithinChallenge<T extends { solvedAt: Date }>(
  problems: readonly T[],
  window: ChallengeWindow,
): T[] {
  return problems.filter((problem) => isWithinChallenge(problem.solvedAt, window));
}

/**
 * Progress derived from problem-level rows.
 *
 * Deduplicates by problem slug, so the same problem solved twice counts once, and
 * discards anything outside the challenge window.
 */
export function progressFromProblems(
  problems: readonly SolvedAt[],
  window: ChallengeWindow,
  scoring: ScoringConfig,
): ChallengeProgress {
  const counted = new Set<string>();
  const counts: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };

  for (const problem of problems) {
    if (!isWithinChallenge(problem.solvedAt, window)) continue;
    if (counted.has(problem.problemSlug)) continue;
    counted.add(problem.problemSlug);

    if (problem.difficulty === "EASY") counts.easy += 1;
    else if (problem.difficulty === "MEDIUM") counts.medium += 1;
    else if (problem.difficulty === "HARD") counts.hard += 1;
  }

  return {
    ...counts,
    // `total` counts every in-window distinct problem, including any whose difficulty
    // we have not resolved yet, so the feed total never under-reports.
    total: counted.size,
    points: computePoints(counts, scoring),
  };
}

/**
 * Rewinds a baseline from "lifetime count at registration" to "lifetime count at the
 * challenge start".
 *
 * Students do not all register on day one. Somebody who solved four problems on 1
 * September and signed up on the 2nd would otherwise have those four folded into their
 * baseline and lose them entirely — the challenge is supposed to measure work done
 * during the window, not work done after signing a form.
 *
 * So we subtract the in-window problems we can see they had already solved. The result
 * is an estimate of what their counter read when the challenge opened, which is exactly
 * what `progressFromBaseline` wants.
 *
 * Two honest limitations:
 *  - LeetCode publishes only the last ~20 accepted submissions, so work older than that
 *    window cannot be recovered and still ends up in the baseline.
 *  - That feed cannot distinguish a first solve from a re-solve of an older problem, so
 *    a student who re-solved a pre-challenge problem during the window may be credited
 *    once for it. Under-counting real work is the worse failure of the two.
 */
export function withPreRegistrationCredit(
  progress: ChallengeProgress,
  credit: DifficultyCounts,
  scoring: ScoringConfig,
): ChallengeProgress {
  const counts: DifficultyCounts = {
    easy: progress.easy + credit.easy,
    medium: progress.medium + credit.medium,
    hard: progress.hard + credit.hard,
  };

  return {
    ...counts,
    total: counts.easy + counts.medium + counts.hard,
    points: computePoints(counts, scoring),
  };
}

export function rewindBaselineToChallengeStart(
  lifetimeAtRegistration: LifetimeStats,
  alreadySolvedInWindow: DifficultyCounts,
): Baseline {
  const easy = atLeastZero(lifetimeAtRegistration.easy - alreadySolvedInWindow.easy);
  const medium = atLeastZero(lifetimeAtRegistration.medium - alreadySolvedInWindow.medium);
  const hard = atLeastZero(lifetimeAtRegistration.hard - alreadySolvedInWindow.hard);

  return {
    easy,
    medium,
    hard,
    // Derived from the parts so the total can never disagree with the breakdown.
    total: atLeastZero(
      lifetimeAtRegistration.total -
        (lifetimeAtRegistration.easy - easy) -
        (lifetimeAtRegistration.medium - medium) -
        (lifetimeAtRegistration.hard - hard),
    ),
  };
}

/**
 * Whether a baseline should be re-based rather than used.
 *
 * A student who registers before the challenge opens keeps getting their baseline moved
 * forward on every sync, so anything they solve in August is folded into the baseline
 * and cannot count. The baseline locks on the first sync at or after the start instant.
 */
export function shouldRebaseBaseline(
  window: ChallengeWindow,
  baselineLockedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (baselineLockedAt !== null) return false;
  return now.getTime() < window.startDate.getTime();
}

/** Whether this sync is the one that should freeze the baseline in place. */
export function shouldLockBaseline(
  window: ChallengeWindow,
  baselineLockedAt: Date | null,
  now: Date = new Date(),
): boolean {
  return baselineLockedAt === null && now.getTime() >= window.startDate.getTime();
}

export function lifetimeFrom(counts: DifficultyCounts, total?: number): LifetimeStats {
  return {
    ...counts,
    total: total ?? counts.easy + counts.medium + counts.hard,
  };
}
