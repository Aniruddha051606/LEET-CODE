import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Prisma 7 connects through a driver adapter rather than a Rust engine, so the pool is
 * a plain `pg` pool configured here. Next.js hot-reloads modules in development, which
 * would otherwise open a new pool on every edit until Postgres refuses connections, so
 * the instance is stashed on `globalThis`.
 */

type SslConfig = { ca: string; rejectUnauthorized: true } | { rejectUnauthorized: false } | undefined;

/**
 * Decides how the database connection is secured.
 *
 * Managed providers frequently present a certificate signed by their own CA rather than
 * a publicly trusted one — Supabase's direct endpoint is issued by "Supabase
 * Intermediate 2021 CA", which Node rejects as a self-signed chain. Pointing
 * `DATABASE_CA_CERT_PATH` at that CA keeps the connection encrypted *and* verified,
 * which is strictly better than turning verification off.
 *
 * `DATABASE_SSL_NO_VERIFY=true` remains available as an explicit, deliberate escape
 * hatch. It is never chosen implicitly, so a connection cannot silently lose
 * verification because a certificate file went missing.
 */
function resolveSsl(): SslConfig {
  const inlineCert = env.databaseCaCert;
  if (inlineCert) {
    return { ca: inlineCert, rejectUnauthorized: true };
  }

  const certPath = env.databaseCaCertPath;
  if (certPath) {
    const resolved = path.isAbsolute(certPath) ? certPath : path.join(process.cwd(), certPath);
    // A missing or unreadable CA is a configuration error, not a reason to downgrade.
    return { ca: readFileSync(resolved, "utf8"), rejectUnauthorized: true };
  }

  if (env.databaseSslNoVerify) {
    return { rejectUnauthorized: false };
  }

  // Nothing specified: let the connection string's own sslmode govern.
  return undefined;
}

const createClient = (): PrismaClient => {
  const ssl = resolveSsl();

  const adapter = new PrismaPg({
    connectionString: env.databaseUrl,
    ...(ssl ? { ssl } : {}),
    // Comfortably below the connection limits of hosted Postgres free tiers while still
    // allowing the leaderboard and sync to work concurrently.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
