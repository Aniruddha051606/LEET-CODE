/**
 * One-off repair for baselines that were adjusted by an earlier, unsafe version.
 *
 *   npm run repair:baselines            Dry run - shows what would change
 *   npm run repair:baselines -- --apply Apply the corrections
 *
 * Why this exists
 * ---------------
 * Registration records a student's lifetime solved count as their baseline. For anyone
 * who joined after day one, that count already contains the problems they had solved
 * earlier in the challenge window, so those problems went uncounted.
 *
 * The first attempt at fixing this SUBTRACTED that work from the stored baseline. That
 * turned out to be unsafe: a subtraction is a one-way edit, and when the same correction
 * ran twice — once in registration, once in the sync — it subtracted twice and inflated
 * scores.
 *
 * The sync now derives the correction fresh on every run instead (see
 * `withPreRegistrationCredit`), which cannot drift. This script repairs the baselines
 * that the earlier version already damaged, by resetting each one to
 *
 *     baseline = current lifetime count - problems observed inside the window
 *
 * so that a student's challenge total equals exactly the in-window problems we have
 * actually recorded for them. Ordinary day-to-day tracking takes over from there.
 *
 * Idempotence
 * -----------
 * A repaired student is stamped with `baselineCapturedAt` at the challenge start, which
 * is the moment their baseline now describes. That also switches off the
 * pre-registration credit for them, because their baseline already accounts for it.
 * Students already stamped are skipped, so this cannot run twice.
 */

import "../prisma/load-env";

import { getChallengeSettings } from "../src/lib/challenge/config";
import { computePoints, tallyDifficulties } from "../src/lib/challenge/scoring";
import type { DifficultyCounts } from "../src/lib/challenge/types";
import { prisma } from "../src/lib/db";
import { recomputeRanks, syncStudent } from "../src/lib/services/sync";

function atLeastZero(value: number): number {
  return value > 0 ? value : 0;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  // Recomputes even for students already anchored at the challenge start. Needed once,
  // to undo baselines that the unsafe subtraction had already damaged before the marker
  // was written. Safe to repeat: the target baseline is derived from observed data, not
  // from the current stored value, so it converges rather than drifting.
  const force = process.argv.includes("--force");
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
      leetcodeUsername: true,
      joinedAt: true,
      baselineCapturedAt: true,
      baselineTotalSolved: true,
      challengeSolved: true,
      profile: {
        select: { totalSolved: true, easySolved: true, mediumSolved: true, hardSolved: true },
      },
      solvedProblems: {
        where: { solvedAt: { gte: settings.startDate, lte: settings.endDate } },
        select: { problemSlug: true, difficulty: true },
      },
    },
  });

  console.log(`${apply ? "APPLYING" : "DRY RUN"} - challenge start ${settings.startDate.toISOString()}\n`);

  let changed = 0;

  for (const student of students) {
    const capturedAt = student.baselineCapturedAt ?? student.joinedAt;

    if (!force && capturedAt.getTime() <= settings.startDate.getTime()) {
      console.log(`skip  @${student.leetcodeUsername} - baseline already anchored at the challenge start`);
      continue;
    }
    if (!student.profile) {
      console.log(`skip  @${student.leetcodeUsername} - no profile fetched yet, let the sync run first`);
      continue;
    }

    // Distinct in-window problems we have actually observed for this student.
    const distinct = new Map(
      student.solvedProblems.map((problem) => [problem.problemSlug, problem.difficulty]),
    );
    const observed: DifficultyCounts = tallyDifficulties([...distinct.values()]);
    const observedTotal = distinct.size;

    const baseline = {
      total: atLeastZero(student.profile.totalSolved - observedTotal),
      easy: atLeastZero(student.profile.easySolved - observed.easy),
      medium: atLeastZero(student.profile.mediumSolved - observed.medium),
      hard: atLeastZero(student.profile.hardSolved - observed.hard),
    };

    const wouldShow = student.profile.totalSolved - baseline.total;

    console.log(
      `FIX   @${student.leetcodeUsername.padEnd(20)} baseline ${student.baselineTotalSolved} -> ${baseline.total}` +
        `  |  shown ${student.challengeSolved} -> ${wouldShow}` +
        `  (lifetime ${student.profile.totalSolved}, observed in-window ${observedTotal}: ` +
        `${observed.easy}E ${observed.medium}M ${observed.hard}H = ${computePoints(observed, scoring)} pts)`,
    );

    if (apply) {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          baselineTotalSolved: baseline.total,
          baselineEasySolved: baseline.easy,
          baselineMediumSolved: baseline.medium,
          baselineHardSolved: baseline.hard,
          // Anchors the baseline at the challenge start and marks the student repaired.
          baselineCapturedAt: settings.startDate,
        },
      });
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
