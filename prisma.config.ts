import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * As of Prisma 7 the connection URL no longer lives in `schema.prisma`: migration and
 * introspection commands read it from here, while the runtime client gets it through a
 * driver adapter (see `src/lib/db.ts`). Prisma 7 also stopped loading `.env`
 * automatically, so we do it explicitly with Node's built-in loader — no dotenv
 * dependency required.
 *
 * In CI and on hosting platforms there is no `.env` file and the variables are already
 * present in the environment, which is why a missing file is not an error.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file: the environment is expected to provide the URLs directly.
}

/**
 * Migrations deliberately prefer `DIRECT_DATABASE_URL`.
 *
 * The application runs through a transaction-mode connection pooler, which is right for
 * serverless but wrong for schema changes: DDL and Prisma's advisory locks need a single
 * uninterrupted session. Point `DIRECT_DATABASE_URL` at the direct (or session-mode)
 * endpoint and `DATABASE_URL` at the pooler. When only `DATABASE_URL` is set — the usual
 * case for a plain local Postgres — both fall back to it.
 */
const migrationUrl = process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!migrationUrl) {
  throw new Error(
    "Set DATABASE_URL (and optionally DIRECT_DATABASE_URL for migrations). See .env.example.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
});
