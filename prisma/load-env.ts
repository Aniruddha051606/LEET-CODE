/**
 * Loads `.env` before anything else is evaluated.
 *
 * This has to be its own module: `import` statements are hoisted and evaluated before
 * any top-level statement in the importing file, so calling `process.loadEnvFile()` at
 * the top of `seed.ts` would still run *after* the database module had already been
 * imported and read a missing `DATABASE_URL`. Importing this first fixes the order.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file: the environment is expected to provide the variables directly.
}

export {};
