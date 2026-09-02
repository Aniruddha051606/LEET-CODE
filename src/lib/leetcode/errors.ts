/**
 * Provider errors are kept separate from application errors on purpose.
 *
 * A failure to reach LeetCode is not a bug in the challenge platform and must never be
 * surfaced to a student as a stack trace, nor silently swallowed and replaced with
 * invented statistics. It is recorded against the student as a sync failure and retried.
 */

export type LeetCodeErrorCode =
  /** The username does not correspond to a public LeetCode profile. */
  | "USER_NOT_FOUND"
  /** LeetCode asked us to slow down. */
  | "RATE_LIMITED"
  /** The request exceeded our timeout. */
  | "TIMEOUT"
  /** DNS, TLS, socket or other transport failure. */
  | "NETWORK"
  /** LeetCode answered, but with an error or a non-2xx status. */
  | "UPSTREAM"
  /** LeetCode answered with a shape we do not understand. */
  | "MALFORMED";

export class LeetCodeProviderError extends Error {
  readonly code: LeetCodeErrorCode;
  /** Whether retrying the same request later could plausibly succeed. */
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    code: LeetCodeErrorCode,
    message: string,
    options: { retryable?: boolean; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LeetCodeProviderError";
    this.code = code;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE[code];
    this.status = options.status;
  }
}

const DEFAULT_RETRYABLE: Record<LeetCodeErrorCode, boolean> = {
  USER_NOT_FOUND: false,
  RATE_LIMITED: true,
  TIMEOUT: true,
  NETWORK: true,
  UPSTREAM: true,
  MALFORMED: false,
};

export function isLeetCodeProviderError(error: unknown): error is LeetCodeProviderError {
  return error instanceof LeetCodeProviderError;
}

/**
 * A message safe to show a student. Never leaks URLs, status codes or stack traces.
 */
export function userFacingMessage(error: unknown): string {
  if (!isLeetCodeProviderError(error)) {
    return "Something went wrong while talking to LeetCode. We will try again shortly.";
  }
  switch (error.code) {
    case "USER_NOT_FOUND":
      return "We couldn't find that LeetCode profile. Check the username and try again.";
    case "RATE_LIMITED":
      return "LeetCode is rate limiting us right now. We will retry automatically in a few minutes.";
    case "TIMEOUT":
    case "NETWORK":
      return "We couldn't reach LeetCode just now. We will try again shortly.";
    case "UPSTREAM":
    case "MALFORMED":
      return "LeetCode returned an unexpected response. We will try again shortly.";
  }
}
