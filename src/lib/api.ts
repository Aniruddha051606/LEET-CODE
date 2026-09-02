import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AdminAuthError } from "@/lib/auth/admin";
import { isLeetCodeProviderError, userFacingMessage } from "@/lib/leetcode/errors";
import { consume, clientKey, type RateLimitRule } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/validation";
import { isProduction } from "@/lib/env";

/**
 * Shared response helpers.
 *
 * One rule runs through all of it: clients get a useful message and a correct status
 * code, and never an internal error string or a stack trace. Unexpected failures are
 * logged server-side with detail and answered with a generic message.
 */

export interface ApiErrorBody {
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function fail(
  status: number,
  error: string,
  extra: Omit<ApiErrorBody, "error"> = {},
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, ...extra }, { status });
}

export function rateLimited(retryAfterSeconds: number): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** Applies a rate limit, returning a 429 response when the caller has exceeded it. */
export function enforceRateLimit(
  request: Request,
  scope: string,
  rule: RateLimitRule,
): NextResponse<ApiErrorBody> | null {
  const verdict = consume(clientKey(request.headers, scope), rule);
  return verdict.allowed ? null : rateLimited(verdict.retryAfterSeconds);
}

/**
 * Converts any thrown value into a safe response.
 * Known error shapes get a precise status; anything else is a logged 500.
 */
export function toErrorResponse(error: unknown, context: string): NextResponse<ApiErrorBody> {
  if (error instanceof AdminAuthError) {
    return fail(401, "Authentication required.", { code: "UNAUTHORIZED" });
  }

  if (error instanceof ZodError) {
    return fail(400, "Some fields need attention.", {
      code: "VALIDATION_FAILED",
      fields: fieldErrors(error),
    });
  }

  if (isLeetCodeProviderError(error)) {
    const status = error.code === "USER_NOT_FOUND" ? 404 : error.code === "RATE_LIMITED" ? 503 : 502;
    return fail(status, userFacingMessage(error), { code: error.code });
  }

  // Genuinely unexpected. Log the detail where operators can see it; tell the caller nothing.
  console.error(`[api:${context}]`, error);
  return fail(500, "Something went wrong on our side. Please try again.", { code: "INTERNAL" });
}

/** Wraps a route handler so no unhandled error can escape as a stack trace. */
export async function handle<T>(
  context: string,
  handler: () => Promise<NextResponse<T> | NextResponse<ApiErrorBody>>,
): Promise<NextResponse<T> | NextResponse<ApiErrorBody>> {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error, context);
  }
}

/**
 * Authorises a cron or operator-triggered global sync.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically. When the secret
 * is unset the endpoint is closed rather than open — in production it is refused
 * outright, and in development it is allowed so the flow can be exercised locally.
 */
export function isCronAuthorised(request: Request, cronSecret: string | undefined): boolean {
  if (!cronSecret) return !isProduction;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (provided.length !== cronSecret.length) return false;

  // Constant-time-ish comparison; lengths already match.
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ cronSecret.charCodeAt(index);
  }
  return mismatch === 0;
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
