import { defineConfig, env } from "prisma/config";

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
  // No .env file: the environment is expected to provide DATABASE_URL directly.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
});
