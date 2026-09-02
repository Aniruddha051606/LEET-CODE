/**
 * Runs a global synchronisation from the command line.
 *
 *   npm run sync                 Sync the 200 stalest students
 *   npm run sync -- --limit 500  Sync up to 500
 *   npm run sync -- --all        Sync every registered student
 *
 * Useful for the first run after seeding, for backfilling, and for cron on a host that
 * has no HTTP scheduler. It performs exactly the same work as `POST /api/sync`.
 */

process.loadEnvFile?.();

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const limitFlag = args.indexOf("--limit");
  const explicitLimit = limitFlag >= 0 ? Number(args[limitFlag + 1]) : undefined;
  const limit = args.includes("--all") ? 100_000 : (explicitLimit ?? 200);

  const concurrencyFlag = args.indexOf("--concurrency");
  const concurrency = concurrencyFlag >= 0 ? Number(args[concurrencyFlag + 1]) : 4;

  if (!Number.isFinite(limit) || limit <= 0) {
    console.error("--limit must be a positive number");
    process.exitCode = 1;
    return;
  }

  // Imported lazily so that the environment is loaded before the database module runs.
  const { syncAllStudents } = await import("../src/lib/services/sync");
  const { prisma } = await import("../src/lib/db");

  console.log(`Starting sync (limit=${limit}, concurrency=${concurrency})...`);
  const started = Date.now();

  const summary = await syncAllStudents({ trigger: "MANUAL", limit, concurrency });

  console.log(
    [
      "",
      `Processed  ${summary.totalStudents}`,
      `Succeeded  ${summary.succeeded}`,
      `Failed     ${summary.failed}`,
      `Skipped    ${summary.skipped}`,
      `Duration   ${Math.round((Date.now() - started) / 1000)}s`,
    ].join("\n"),
  );

  const failures = summary.results.filter((result) => result.status === "FAILED");
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures.slice(0, 20)) {
      console.log(`  ${failure.username || failure.studentId}: ${failure.error ?? "unknown"}`);
    }
    if (failures.length > 20) console.log(`  ...and ${failures.length - 20} more`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
