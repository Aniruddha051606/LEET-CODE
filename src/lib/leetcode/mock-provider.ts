/**
 * Development-only LeetCode provider.
 *
 * This exists so the app can be run and demoed without hitting LeetCode, and so the
 * seed script can generate a populated leaderboard. It is deterministic: the same
 * username always produces the same figures, which makes local behaviour reproducible.
 *
 * It is deliberately NOT a fallback. The factory in `index.ts` refuses to construct it
 * when NODE_ENV is production, and nothing ever falls back to it when the real provider
 * fails — a failed fetch is recorded as a failure, never papered over with invented
 * statistics.
 */

import { LeetCodeProviderError } from "./errors";
import {
  isValidUsernameFormat,
  profileUrlFor,
  type LeetCodeActivityDay,
  type LeetCodeProblemMeta,
  type LeetCodeProfileData,
  type LeetCodeProvider,
  type LeetCodeSolvedProblem,
} from "./types";
import type { Difficulty } from "@/lib/challenge/types";

/** Deterministic 32-bit hash, so a username always yields the same fake profile. */
function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_PROBLEMS: ReadonlyArray<{ slug: string; title: string; difficulty: Difficulty }> = [
  { slug: "two-sum", title: "Two Sum", difficulty: "EASY" },
  { slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "EASY" },
  { slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "EASY" },
  { slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "EASY" },
  { slug: "climbing-stairs", title: "Climbing Stairs", difficulty: "EASY" },
  { slug: "longest-substring-without-repeating-characters", title: "Longest Substring Without Repeating Characters", difficulty: "MEDIUM" },
  { slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "MEDIUM" },
  { slug: "3sum", title: "3Sum", difficulty: "MEDIUM" },
  { slug: "group-anagrams", title: "Group Anagrams", difficulty: "MEDIUM" },
  { slug: "coin-change", title: "Coin Change", difficulty: "MEDIUM" },
  { slug: "course-schedule", title: "Course Schedule", difficulty: "MEDIUM" },
  { slug: "rotate-image", title: "Rotate Image", difficulty: "MEDIUM" },
  { slug: "median-of-two-sorted-arrays", title: "Median of Two Sorted Arrays", difficulty: "HARD" },
  { slug: "trapping-rain-water", title: "Trapping Rain Water", difficulty: "HARD" },
  { slug: "merge-k-sorted-lists", title: "Merge k Sorted Lists", difficulty: "HARD" },
  { slug: "word-ladder", title: "Word Ladder", difficulty: "HARD" },
];

/** Usernames the mock treats as nonexistent, so the "profile not found" path is testable. */
const UNKNOWN_USERNAMES = new Set(["ghost", "doesnotexist", "unknown"]);

export class LeetCodeMockProvider implements LeetCodeProvider {
  readonly name = "leetcode-mock";

  private assertKnown(username: string): void {
    if (!isValidUsernameFormat(username) || UNKNOWN_USERNAMES.has(username.toLowerCase())) {
      throw new LeetCodeProviderError("USER_NOT_FOUND", `No LeetCode profile for "${username}"`);
    }
  }

  async getProfile(username: string): Promise<LeetCodeProfileData> {
    this.assertKnown(username);
    const random = seeded(hash(username.toLowerCase()));

    const easySolved = 20 + Math.floor(random() * 120);
    const mediumSolved = 10 + Math.floor(random() * 160);
    const hardSolved = Math.floor(random() * 45);
    const totalSolved = easySolved + mediumSolved + hardSolved;

    return {
      username,
      profileUrl: profileUrlFor(username),
      realName: null,
      avatarUrl: null,
      ranking: 20_000 + Math.floor(random() * 800_000),
      reputation: Math.floor(random() * 400),
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      totalSubmissions: Math.round(totalSolved * (1.6 + random())),
      fetchedAt: new Date(),
    };
  }

  async getSolvedProblems(username: string, limit = 20): Promise<LeetCodeSolvedProblem[]> {
    this.assertKnown(username);
    const random = seeded(hash(`solved:${username.toLowerCase()}`));
    const count = Math.min(limit, 5 + Math.floor(random() * 15));

    return Array.from({ length: count }, (_, index) => {
      const problem = SAMPLE_PROBLEMS[Math.floor(random() * SAMPLE_PROBLEMS.length)] ?? SAMPLE_PROBLEMS[0]!;
      return {
        submissionId: `mock-${hash(`${username}:${index}`)}`,
        problemSlug: problem.slug,
        title: problem.title,
        solvedAt: new Date(Date.now() - index * 6 * 60 * 60 * 1000),
      } satisfies LeetCodeSolvedProblem;
    });
  }

  async getRecentActivity(username: string, year: number): Promise<LeetCodeActivityDay[]> {
    this.assertKnown(username);
    const random = seeded(hash(`calendar:${username.toLowerCase()}:${year}`));
    const days: LeetCodeActivityDay[] = [];

    for (let dayOfYear = 0; dayOfYear < 366; dayOfYear += 1) {
      const instant = new Date(Date.UTC(year, 0, 1 + dayOfYear));
      if (instant.getUTCFullYear() !== year) break;
      if (random() > 0.45) continue;
      days.push({
        utcDay: instant.toISOString().slice(0, 10),
        instant,
        submissions: 1 + Math.floor(random() * 6),
      });
    }

    return days;
  }

  async getProblem(slug: string): Promise<LeetCodeProblemMeta | null> {
    const known = SAMPLE_PROBLEMS.find((problem) => problem.slug === slug);
    if (!known) return null;
    return { ...known, questionId: String(hash(slug) % 3000) };
  }

  async usernameExists(username: string): Promise<boolean> {
    return isValidUsernameFormat(username) && !UNKNOWN_USERNAMES.has(username.toLowerCase());
  }
}
