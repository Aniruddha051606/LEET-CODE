import "server-only";

import { env, isProduction } from "@/lib/env";

import { LeetCodeGraphQlProvider } from "./graphql-provider";
import { LeetCodeMockProvider } from "./mock-provider";
import type { LeetCodeProvider } from "./types";

export * from "./errors";
export * from "./types";
export { LeetCodeGraphQlProvider } from "./graphql-provider";
export { LeetCodeMockProvider } from "./mock-provider";

/**
 * Provider factory.
 *
 * The instance is cached per process so that the rate limiter and caches are genuinely
 * shared — creating a provider per request would defeat both.
 *
 * The mock provider is unavailable in production, by construction rather than by
 * convention: asking for it there is a startup error, not a silent downgrade to fake data.
 */
let cached: LeetCodeProvider | null = null;

export function getLeetCodeProvider(): LeetCodeProvider {
  if (cached) return cached;

  if (env.leetcodeProvider === "mock") {
    if (isProduction) {
      throw new Error(
        "LEETCODE_PROVIDER=mock is not allowed in production. The production app must never serve fabricated LeetCode statistics.",
      );
    }
    cached = new LeetCodeMockProvider();
    return cached;
  }

  cached = new LeetCodeGraphQlProvider({
    endpoint: env.leetcodeApiUrl,
    timeoutMs: env.leetcodeTimeoutMs,
    maxRetries: env.leetcodeMaxRetries,
    maxRequestsPerSecond: env.leetcodeMaxRps,
  });
  return cached;
}

/** Test seam: lets a test or script swap the provider without touching the environment. */
export function setLeetCodeProvider(provider: LeetCodeProvider | null): void {
  cached = provider;
}
