/**
 * The production LeetCode provider.
 *
 * It talks to LeetCode's public GraphQL endpoint (https://leetcode.com/graphql) — the
 * same endpoint the public profile pages use, reading only data that is already public.
 * There is no official documented API and no credentials are involved, so we treat it
 * as a best-effort source: polite rate limiting, timeouts, retries, and honest errors
 * when it is unavailable.
 *
 * Verified behaviour of the endpoint (checked against live responses):
 *   - `matchedUser` returns null with a GraphQL error for unknown usernames.
 *   - `submitStatsGlobal.acSubmissionNum` gives DISTINCT solved counts per difficulty.
 *   - `recentAcSubmissionList` is hard-capped at 20 entries regardless of `limit`.
 *   - `userCalendar.submissionCalendar` is a JSON string keyed by midnight-UTC epoch
 *     seconds, valued with that day's submission count.
 */

import type { Difficulty } from "@/lib/challenge/types";

import { LeetCodeProviderError } from "./errors";
import { RateLimiter, TtlCache, requestWithRetry, type RequestOptions } from "./http";
import {
  isValidUsernameFormat,
  profileUrlFor,
  type LeetCodeActivityDay,
  type LeetCodeProblemMeta,
  type LeetCodeProfileData,
  type LeetCodeProvider,
  type LeetCodeSolvedProblem,
} from "./types";

/** LeetCode ignores larger values; asking for more is pointless. */
export const RECENT_SUBMISSION_CAP = 20;

interface GraphQlResponse<T> {
  data?: T | null;
  errors?: Array<{ message?: string }>;
}

interface AcSubmissionNum {
  difficulty: string;
  count: number;
  submissions: number;
}

interface MatchedUserStats {
  matchedUser: {
    username: string;
    profile: {
      ranking: number | null;
      reputation: number | null;
      realName: string | null;
      userAvatar: string | null;
    } | null;
    submitStatsGlobal: { acSubmissionNum: AcSubmissionNum[] } | null;
  } | null;
}

interface RecentSubmissions {
  recentAcSubmissionList:
    | Array<{ id: string; title: string; titleSlug: string; timestamp: string }>
    | null;
}

interface UserCalendar {
  matchedUser: {
    userCalendar: { submissionCalendar: string | null } | null;
  } | null;
}

interface QuestionMeta {
  question: {
    questionFrontendId: string | null;
    title: string;
    titleSlug: string;
    difficulty: string;
  } | null;
}

const PROFILE_QUERY = `query challengeProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { ranking reputation realName userAvatar }
    submitStatsGlobal { acSubmissionNum { difficulty count submissions } }
  }
}`;

const RECENT_QUERY = `query challengeRecent($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}`;

const CALENDAR_QUERY = `query challengeCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) { submissionCalendar }
  }
}`;

const QUESTION_QUERY = `query challengeQuestion($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    difficulty
  }
}`;

function parseDifficulty(value: string): Difficulty | null {
  switch (value.toLowerCase()) {
    case "easy":
      return "EASY";
    case "medium":
      return "MEDIUM";
    case "hard":
      return "HARD";
    default:
      return null;
  }
}

function looksLikeMissingUser(errors: Array<{ message?: string }> | undefined): boolean {
  return (errors ?? []).some((error) => /does not exist/i.test(error.message ?? ""));
}

export interface GraphQlProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxRequestsPerSecond?: number;
  /** How long a fetched profile stays reusable. Keeps repeated syncs cheap. */
  profileCacheMs?: number;
}

export class LeetCodeGraphQlProvider implements LeetCodeProvider {
  readonly name = "leetcode-graphql";

  private readonly endpoint: string;
  private readonly requestOptions: RequestOptions;
  private readonly profileCache: TtlCache<LeetCodeProfileData>;
  // Problem metadata is immutable in practice, so it is cached for the process lifetime
  // and additionally persisted in the `Problem` table by the sync service.
  private readonly problemCache = new TtlCache<LeetCodeProblemMeta | null>(6 * 60 * 60 * 1000);

  constructor(options: GraphQlProviderOptions = {}) {
    this.endpoint = options.endpoint ?? "https://leetcode.com/graphql";
    this.requestOptions = {
      timeoutMs: options.timeoutMs ?? 12_000,
      maxRetries: options.maxRetries ?? 3,
      limiter: new RateLimiter(options.maxRequestsPerSecond ?? 4),
    };
    this.profileCache = new TtlCache<LeetCodeProfileData>(options.profileCacheMs ?? 60_000);
  }

  private async query<T>(
    query: string,
    variables: Record<string, unknown>,
    referer: string,
  ): Promise<GraphQlResponse<T>> {
    const response = await requestWithRetry(
      this.endpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          // LeetCode rejects requests without a browser-like UA and referer.
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          referer,
        },
        body: JSON.stringify({ query, variables }),
      },
      this.requestOptions,
    );

    let payload: GraphQlResponse<T>;
    try {
      payload = (await response.json()) as GraphQlResponse<T>;
    } catch (error) {
      throw new LeetCodeProviderError("MALFORMED", "LeetCode returned a non-JSON response", {
        cause: error,
      });
    }

    return payload;
  }

  private assertUsername(username: string): void {
    if (!isValidUsernameFormat(username)) {
      throw new LeetCodeProviderError("USER_NOT_FOUND", "Invalid LeetCode username format");
    }
  }

  async getProfile(username: string): Promise<LeetCodeProfileData> {
    this.assertUsername(username);

    const cached = this.profileCache.get(username.toLowerCase());
    if (cached) return cached;

    const payload = await this.query<MatchedUserStats>(
      PROFILE_QUERY,
      { username },
      profileUrlFor(username),
    );

    const user = payload.data?.matchedUser ?? null;
    if (!user) {
      if (looksLikeMissingUser(payload.errors) || payload.data !== undefined) {
        throw new LeetCodeProviderError("USER_NOT_FOUND", `No LeetCode profile for "${username}"`);
      }
      throw new LeetCodeProviderError("UPSTREAM", "LeetCode did not return a profile");
    }

    const stats = user.submitStatsGlobal?.acSubmissionNum ?? [];
    const byDifficulty = new Map(stats.map((entry) => [entry.difficulty.toLowerCase(), entry]));
    const read = (key: string): AcSubmissionNum =>
      byDifficulty.get(key) ?? { difficulty: key, count: 0, submissions: 0 };

    const all = read("all");
    const profile: LeetCodeProfileData = {
      username: user.username,
      profileUrl: profileUrlFor(user.username),
      realName: user.profile?.realName?.trim() || null,
      avatarUrl: user.profile?.userAvatar ?? null,
      ranking: user.profile?.ranking ?? null,
      reputation: user.profile?.reputation ?? null,
      totalSolved: all.count,
      easySolved: read("easy").count,
      mediumSolved: read("medium").count,
      hardSolved: read("hard").count,
      totalSubmissions: all.submissions,
      fetchedAt: new Date(),
    };

    this.profileCache.set(username.toLowerCase(), profile);
    return profile;
  }

  async getSolvedProblems(username: string, limit = RECENT_SUBMISSION_CAP): Promise<LeetCodeSolvedProblem[]> {
    this.assertUsername(username);

    const payload = await this.query<RecentSubmissions>(
      RECENT_QUERY,
      { username, limit: Math.min(limit, RECENT_SUBMISSION_CAP) },
      profileUrlFor(username),
    );

    const list = payload.data?.recentAcSubmissionList;
    if (!list) {
      if (looksLikeMissingUser(payload.errors)) {
        throw new LeetCodeProviderError("USER_NOT_FOUND", `No LeetCode profile for "${username}"`);
      }
      return [];
    }

    return list
      .map((entry) => {
        const seconds = Number(entry.timestamp);
        if (!Number.isFinite(seconds)) return null;
        return {
          submissionId: entry.id,
          problemSlug: entry.titleSlug,
          title: entry.title,
          solvedAt: new Date(seconds * 1000),
        } satisfies LeetCodeSolvedProblem;
      })
      .filter((entry): entry is LeetCodeSolvedProblem => entry !== null);
  }

  async getRecentActivity(username: string, year: number): Promise<LeetCodeActivityDay[]> {
    this.assertUsername(username);

    const payload = await this.query<UserCalendar>(
      CALENDAR_QUERY,
      { username, year },
      profileUrlFor(username),
    );

    const raw = payload.data?.matchedUser?.userCalendar?.submissionCalendar;
    if (!raw) {
      if (looksLikeMissingUser(payload.errors)) {
        throw new LeetCodeProviderError("USER_NOT_FOUND", `No LeetCode profile for "${username}"`);
      }
      return [];
    }

    let parsed: Record<string, number>;
    try {
      parsed = JSON.parse(raw) as Record<string, number>;
    } catch (error) {
      throw new LeetCodeProviderError("MALFORMED", "Submission calendar was not valid JSON", {
        cause: error,
      });
    }

    return Object.entries(parsed)
      .map(([key, submissions]) => {
        const seconds = Number(key);
        if (!Number.isFinite(seconds)) return null;
        const instant = new Date(seconds * 1000);
        return {
          utcDay: instant.toISOString().slice(0, 10),
          instant,
          submissions: Number(submissions) || 0,
        } satisfies LeetCodeActivityDay;
      })
      .filter((entry): entry is LeetCodeActivityDay => entry !== null)
      .sort((a, b) => a.utcDay.localeCompare(b.utcDay));
  }

  async getProblem(slug: string): Promise<LeetCodeProblemMeta | null> {
    const cached = this.problemCache.get(slug);
    if (cached !== undefined) return cached;

    const payload = await this.query<QuestionMeta>(
      QUESTION_QUERY,
      { titleSlug: slug },
      `https://leetcode.com/problems/${encodeURIComponent(slug)}/`,
    );

    const question = payload.data?.question ?? null;
    const difficulty = question ? parseDifficulty(question.difficulty) : null;

    const meta: LeetCodeProblemMeta | null =
      question && difficulty
        ? {
            slug: question.titleSlug,
            title: question.title,
            difficulty,
            questionId: question.questionFrontendId,
          }
        : null;

    this.problemCache.set(slug, meta);
    return meta;
  }

  async usernameExists(username: string): Promise<boolean> {
    if (!isValidUsernameFormat(username)) return false;
    try {
      await this.getProfile(username);
      return true;
    } catch (error) {
      if (error instanceof LeetCodeProviderError && error.code === "USER_NOT_FOUND") return false;
      throw error;
    }
  }
}
