/**
 * One-off repair for students who registered after the challenge had already started.
 *
 *   npm run repair:baselines            Dry run - shows what would change
 *   npm run repair:baselines -- --apply Apply the corrections
 *
 * Why this exists
 * ---------------
 * Registration originally took the student's lifetime solved count at sign-up as their
 * baseline. For anyone who joined on day two or later, that buried the problems they had
 * already solved inside the challenge window: the work happened during the challenge but
 * was subtracted away, so their dashboard showed zero.
 *
 * `registerStudent` now rewinds the baseline past that work. This script applies the same
 * correction to students who registered before the fix, using the `SolvedProblem` rows
 * already captured for them.
 *
 * Idempotence
 * -----------
 * A repaired student has `baselineCapturedAt` moved back to the challenge start, because
 * that is now the moment the baseline describes. Students already at or before the start
 * are skipped, so running this twice cannot subtract twice.
 */

import "../prisma/load-env";

import { getChallengeSettings } from "../src/lib/challenge/config";
import { rewindBaselineToChallengeStart } from "../src/lib/challenge/progress";
import { computePoints, tallyDifficulties } from "../src/lib/challenge/scoring";
import { prisma } from "../src/lib/db";
import { syncStudent, recomputeRanks } from "../src/lib/services/sync";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const settings = await getChallengeSettings();
  const scoring = {
    easyPoints: settings.easyPoints,
    mediumPoints: settings.mediumPoints,
    hardPoints: settings.hardPoints,
  };

  const students = await prisma.student.findMany({
    where: { isActive: true, isDemo: false },
    select: {
      id: true,
      name: true,
      leetcodeUsername: true,
      joinedAt: true,
      baselineCapturedAt: true,
      baselineTotalSolved: true,
      baselineEasySolved: true,
      baselineMediumSolved: true,
      baselineHardSolved: true,
      challengeSolved: true,
      solvedProblems: {
        select: { problemSlug: true, difficulty: true, solvedAt: true },
      },
    },
  });

  console.log(
    `${apply ? "APPLYING" : "DRY RUN"} - challenge starts ${settings.startDate.toISOString()}\n`,
  );

  let changed = 0;

  for (const student of students) {
    const capturedAt = student.baselineCapturedAt ?? student.joinedAt;

    if (capturedAt.getTime() <= settings.startDate.getTime()) {
      console.log(`skip  @${student.leetcodeUsername} - baseline already at the challenge start`);
      continue;
    }

    // In-window problems solved before this student registered: exactly the work that
    // the old baseline swallowed. Deduplicated by slug.
    const bySlug = new Map(
      student.solvedProblems
        .filter(
          (problem) =>
            problem.solvedAt >= settings.startDate &&
            problem.solvedAt <= settings.endDate &&
            problem.solvedAt < capturedAt,
        )
        .map((problem) => [problem.problemSlug, problem]),
    );

    if (bySlug.size === 0) {
      console.log(`skip  @${student.leetcodeUsername} - no uncounted in-window work`);
      continue;
    }

    const credit = tallyDifficulties([...bySlug.values()].map((problem) => problem.difficulty));
    const lifetimeAtRegistration = {
      total: student.baselineTotalSolved,
      easy: student.baselineEasySolved,
      medium: student.baselineMediumSolved,
      hard: student.baselineHardSolved,
    };
    const baseline = rewindBaselineToChallengeStart(lifetimeAtRegistration, credit);

    console.log(
      `FIX   @${student.leetcodeUsername}  baseline ${lifetimeAtRegistration.total} -> ${baseline.total}` +
        `  (credits ${bySlug.size} problem${bySlug.size === 1 ? "" : "s"}: ` +
        `${credit.easy}E ${credit.medium}M ${credit.hard}H = ${computePoints(credit, scoring)} pts)`,
    );
    for (const problem of bySlug.values()) {
      console.log(`        ${problem.solvedAt.toISOString()}  ${problem.problemSlug} (${problem.difficulty})`);
    }

    if (apply) {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          baselineTotalSolved: baseline.total,
          baselineEasySolved: baseline.easy,
          baselineMediumSolved: baseline.medium,
          baselineHardSolved: baseline.hard,
          // The baseline now describes the challenge start, which also marks this
          // student as repaired so a second run leaves them alone.
          baselineCapturedAt: settings.startDate,
        },
      });
      // Recompute standings, streaks and snapshots from the corrected baseline.
      const result = await syncStudent(student.id);
      console.log(`        resynced: ${result.status} solved=${result.challengeSolved} points=${result.challengePoints}`);
    }

    changed += 1;
  }

  if (apply && changed > 0) {
    await recomputeRanks();
    console.log("\nRanks recomputed.");
  }

  console.log(
    `\n${changed} student${changed === 1 ? "" : "s"} ${apply ? "corrected" : "would be corrected"}.` +
      (apply ? "" : "  Re-run with --apply to make the change."),
  );

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
