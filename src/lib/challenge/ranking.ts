/**
 * Leaderboard ranking.
 *
 * Ranking is by problems solved *during the challenge* first and challenge points
 * second, never by lifetime LeetCode totals. Ties share a rank and the following rank
 * skips accordingly (standard competition ranking: 1, 2, 2, 4).
 *
 * All of this runs server-side. Nothing the client sends can influence a rank.
 */

export interface Rankable {
  id: string;
  challengeSolved: number;
  challengePoints: number;
  /** Final tiebreak: whoever committed to the challenge earlier ranks higher. */
  joinedAt: Date;
}

export interface RankedEntry {
  id: string;
  rank: number;
  position: number;
}

/**
 * Ordering used by both the in-memory ranker and the database query, kept in one place
 * so the two can never drift apart.
 */
export function compareForRank(a: Rankable, b: Rankable): number {
  if (b.challengeSolved !== a.challengeSolved) return b.challengeSolved - a.challengeSolved;
  if (b.challengePoints !== a.challengePoints) return b.challengePoints - a.challengePoints;
  const joinDelta = a.joinedAt.getTime() - b.joinedAt.getTime();
  if (joinDelta !== 0) return joinDelta;
  return a.id.localeCompare(b.id);
}

function isTie(a: Rankable, b: Rankable): boolean {
  return a.challengeSolved === b.challengeSolved && a.challengePoints === b.challengePoints;
}

export function rankStudents(students: readonly Rankable[]): RankedEntry[] {
  const sorted = [...students].sort(compareForRank);
  const ranked: RankedEntry[] = [];

  let currentRank = 0;
  let previous: Rankable | null = null;

  sorted.forEach((student, index) => {
    if (previous === null || !isTie(previous, student)) {
      currentRank = index + 1;
    }
    ranked.push({ id: student.id, rank: currentRank, position: index + 1 });
    previous = student;
  });

  return ranked;
}

export type RankMovement = "UP" | "DOWN" | "SAME" | "NEW";

export interface RankChange {
  movement: RankMovement;
  /** Positions gained. Negative means positions lost. Zero when new or unchanged. */
  delta: number;
}

export function rankChange(rank: number | null, previousRank: number | null): RankChange {
  if (rank === null || previousRank === null) return { movement: "NEW", delta: 0 };
  const delta = previousRank - rank;
  if (delta > 0) return { movement: "UP", delta };
  if (delta < 0) return { movement: "DOWN", delta };
  return { movement: "SAME", delta: 0 };
}

/**
 * Percentile from the top, where rank 1 in a field of 100 is the 1st percentile.
 * Used for the "you are in the top N%" nudge on the dashboard.
 */
export function topPercentile(rank: number, total: number): number {
  if (total <= 0 || rank <= 0) return 100;
  return Math.max(1, Math.ceil((rank / total) * 100));
}

/** Problems needed to catch the student directly above. Null when already first. */
export function gapToNextRank(
  current: Pick<Rankable, "challengeSolved" | "challengePoints">,
  above: Pick<Rankable, "challengeSolved" | "challengePoints"> | null,
): number | null {
  if (above === null) return null;
  const solvedGap = above.challengeSolved - current.challengeSolved;
  // Level on problems means the gap is decided by points, which one more solve settles.
  if (solvedGap <= 0) return 1;
  return solvedGap + 1;
}
