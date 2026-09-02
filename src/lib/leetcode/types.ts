import type { Difficulty } from "@/lib/challenge/types";

/** Lifetime profile statistics for a LeetCode user. */
export interface LeetCodeProfileData {
  /** Canonical username exactly as LeetCode spells it. */
  username: string;
  profileUrl: string;
  realName: string | null;
  avatarUrl: string | null;
  ranking: number | null;
  reputation: number | null;

  // Lifetime counts of DISTINCT problems solved, per difficulty.
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;

  /** Lifetime accepted-submission count (not distinct problems). */
  totalSubmissions: number;

  fetchedAt: Date;
}

/** A single accepted submission. */
export interface LeetCodeSolvedProblem {
  submissionId: string;
  problemSlug: string;
  title: string;
  /** The true submission instant reported by LeetCode. */
  solvedAt: Date;
}

/** One day of the user's public submission calendar. */
export interface LeetCodeActivityDay {
  /** UTC calendar day (`YYYY-MM-DD`) as keyed by LeetCode's calendar. */
  utcDay: string;
  /** Midnight-UTC instant for that day, from LeetCode's own key. */
  instant: Date;
  submissions: number;
}

export interface LeetCodeProblemMeta {
  slug: string;
  title: string;
  difficulty: Difficulty;
  questionId: string | null;
}

/**
 * The only surface the rest of the application is allowed to know about.
 *
 * Everything above this line is "how we get LeetCode data"; everything below it is
 * "what the challenge does with it". Swapping in a different data source means writing
 * a new implementation of this interface and nothing else.
 *
 * Known limitation of every current implementation: LeetCode publishes only the most
 * recent ~20 accepted submissions per user, so `getSolvedProblems` returns a rolling
 * window rather than full history. Challenge totals are therefore derived from profile
 * counters (see `src/lib/challenge/progress.ts`), not from this list.
 */
export interface LeetCodeProvider {
  /** Identifies the implementation in logs and the admin panel. */
  readonly name: string;

  /** Throws `USER_NOT_FOUND` when the profile does not exist. */
  getProfile(username: string): Promise<LeetCodeProfileData>;

  /** Recently solved problems, newest first. Capped by the upstream API. */
  getSolvedProblems(username: string, limit?: number): Promise<LeetCodeSolvedProblem[]>;

  /** Daily submission activity for a calendar year, used for the heatmap. */
  getRecentActivity(username: string, year: number): Promise<LeetCodeActivityDay[]>;

  /** Resolves a problem's difficulty. Returns null when the slug is unknown. */
  getProblem(slug: string): Promise<LeetCodeProblemMeta | null>;

  /** Cheap existence check used at registration time. */
  usernameExists(username: string): Promise<boolean>;
}

/** LeetCode usernames: letters, digits, underscore and hyphen, 1-39 characters. */
export const LEETCODE_USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,39}$/;

export function isValidUsernameFormat(username: string): boolean {
  return LEETCODE_USERNAME_PATTERN.test(username);
}

export function profileUrlFor(username: string): string {
  return `https://leetcode.com/u/${encodeURIComponent(username)}/`;
}
