import "server-only";

/**
 * Server-only environment access.
 *
 * Importing `server-only` makes it a build error for any client component to pull this
 * module (and therefore any secret) into the browser bundle. Values are read lazily so
 * that a missing variable fails where it is used, with a message that says which one.
 */

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequired(name: string): string {
  const value = readOptional(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

function readInt(name: string, fallback: number): number {
  const raw = readOptional(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const isProduction = process.env.NODE_ENV === "production";

export const env = {
  get databaseUrl(): string {
    return readRequired("DATABASE_URL");
  },

  /**
   * TLS material for the database connection.
   *
   * Managed Postgres providers often present a certificate signed by their own CA
   * (Supabase does), which Node rejects under default verification. Supplying that CA
   * keeps the connection both encrypted AND verified. `DATABASE_CA_CERT` takes an inline
   * PEM, which suits hosts where only environment variables can be set.
   */
  get databaseCaCert(): string | undefined {
    return readOptional("DATABASE_CA_CERT");
  },
  get databaseCaCertPath(): string | undefined {
    return readOptional("DATABASE_CA_CERT_PATH");
  },
  /** Explicit, deliberate opt-out of certificate verification. */
  get databaseSslNoVerify(): boolean {
    return readOptional("DATABASE_SSL_NO_VERIFY") === "true";
  },

  /** Both admin secrets must be present. Missing values fail closed, never open. */
  get adminPasswordHash(): string | undefined {
    return readOptional("ADMIN_PASSWORD_HASH");
  },
  get adminSessionSecret(): string | undefined {
    return readOptional("ADMIN_SESSION_SECRET");
  },
  get adminConfigured(): boolean {
    return this.adminPasswordHash !== undefined && this.adminSessionSecret !== undefined;
  },

  get cronSecret(): string | undefined {
    return readOptional("CRON_SECRET");
  },

  get leetcodeProvider(): "graphql" | "mock" {
    return readOptional("LEETCODE_PROVIDER") === "mock" ? "mock" : "graphql";
  },
  get leetcodeApiUrl(): string {
    return readOptional("LEETCODE_API_URL") ?? "https://leetcode.com/graphql";
  },
  get leetcodeTimeoutMs(): number {
    return readInt("LEETCODE_TIMEOUT_MS", 12_000);
  },
  get leetcodeMaxRps(): number {
    return readInt("LEETCODE_MAX_RPS", 4);
  },
  get leetcodeMaxRetries(): number {
    return readInt("LEETCODE_MAX_RETRIES", 3);
  },

  get siteUrl(): string {
    return readOptional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
  },
} as const;
