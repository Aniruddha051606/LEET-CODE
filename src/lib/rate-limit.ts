import "server-only";

/**
 * Fixed-window rate limiting for public endpoints.
 *
 * Deliberately in-process: it needs no Redis, adds no dependency, and is the right size
 * for a single-instance college deployment. The trade-off is that limits are per
 * instance, so a horizontally scaled deployment should move `consume` behind a shared
 * store — the call sites do not need to change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. Sent as `Retry-After`. */
  retryAfterSeconds: number;
}

export const RATE_LIMITS = {
  /** Registration hits LeetCode, so it is the tightest limit. */
  registration: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Read-only public JSON endpoints. */
  publicRead: { limit: 120, windowMs: 60 * 1000 },
  /** Student-triggered refresh. */
  manualSync: { limit: 4, windowMs: 10 * 60 * 1000 },
  /** Admin login, to blunt password guessing. */
  adminLogin: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

function evictIfNeeded(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
  // Still full of live windows: drop the oldest insertion to bound memory.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next();
    if (!oldest.done) buckets.delete(oldest.value);
  }
}

export function consume(key: string, rule: RateLimitRule): RateLimitVerdict {
  const now = Date.now();
  evictIfNeeded(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: rule.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client identity from proxy headers.
 *
 * These headers are spoofable in general; behind Vercel or any sane reverse proxy the
 * left-most `x-forwarded-for` entry is set by the platform. This is abuse dampening,
 * not an access control, and nothing security-critical depends on it.
 */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `${scope}:${ip}`;
}
