/**
 * Transport concerns for the LeetCode provider: throttling, timeouts, retries.
 *
 * LeetCode's GraphQL endpoint is a public courtesy, not a contracted API. We stay
 * deliberately polite: a process-wide sliding-window rate limiter caps how fast we can
 * ever hit it, every request has a hard timeout, and transient failures back off
 * exponentially with jitter rather than hammering.
 */

import { LeetCodeProviderError } from "./errors";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sliding-window limiter. Allows at most `maxPerSecond` starts in any rolling second,
 * shared by every caller in the process, while still letting requests overlap.
 */
export class RateLimiter {
  private readonly starts: number[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly maxPerSecond: number) {}

  /** Resolves when the caller is allowed to start a request. */
  acquire(): Promise<void> {
    const next = this.chain.then(() => this.waitForSlot());
    // Failures must not poison the queue for subsequent callers.
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (this.starts.length > 0 && now - (this.starts[0] as number) >= 1000) {
        this.starts.shift();
      }
      if (this.starts.length < this.maxPerSecond) {
        this.starts.push(now);
        return;
      }
      const oldest = this.starts[0] as number;
      await sleep(Math.max(1, 1000 - (now - oldest)));
    }
  }
}

export interface RequestOptions {
  timeoutMs: number;
  maxRetries: number;
  limiter: RateLimiter;
}

/** Retry delay: 400ms, 800ms, 1600ms ... plus jitter, capped at 8 seconds. */
function backoffMs(attempt: number): number {
  const base = Math.min(400 * 2 ** attempt, 8000);
  return base + Math.floor(Math.random() * 250);
}

function toProviderError(error: unknown): LeetCodeProviderError {
  if (error instanceof LeetCodeProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new LeetCodeProviderError("TIMEOUT", "LeetCode request timed out", { cause: error });
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return new LeetCodeProviderError("TIMEOUT", "LeetCode request timed out", { cause: error });
  }
  return new LeetCodeProviderError("NETWORK", "Could not reach LeetCode", { cause: error });
}

/**
 * Performs a single HTTP request under the limiter with a hard timeout.
 * Maps transport and status failures onto `LeetCodeProviderError`.
 */
async function performRequest(
  url: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<Response> {
  await options.limiter.acquire();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (response.status === 429) {
      throw new LeetCodeProviderError("RATE_LIMITED", "LeetCode rate limited the request", {
        status: 429,
      });
    }
    if (response.status >= 500) {
      throw new LeetCodeProviderError("UPSTREAM", `LeetCode returned ${response.status}`, {
        status: response.status,
        retryable: true,
      });
    }
    if (!response.ok) {
      throw new LeetCodeProviderError("UPSTREAM", `LeetCode returned ${response.status}`, {
        status: response.status,
        retryable: false,
      });
    }

    return response;
  } catch (error) {
    throw toProviderError(error);
  } finally {
    clearTimeout(timer);
  }
}

/** Runs a request with exponential backoff over retryable failures only. */
export async function requestWithRetry(
  url: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<Response> {
  let lastError: LeetCodeProviderError | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await performRequest(url, init, options);
    } catch (error) {
      const providerError = toProviderError(error);
      lastError = providerError;
      if (!providerError.retryable || attempt === options.maxRetries) break;
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError ?? new LeetCodeProviderError("NETWORK", "Could not reach LeetCode");
}

/**
 * A tiny TTL cache. LeetCode profile data changes slowly, and several pages may ask for
 * the same profile within seconds of each other during a sync.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 2000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Runs tasks with bounded concurrency, preserving input order in the results. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}
