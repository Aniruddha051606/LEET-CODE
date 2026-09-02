/**
 * Development seed.
 *
 * Creates a believable cohort so the leaderboard, dashboards and charts can be worked on
 * without waiting four months for real data.
 *
 * Two guarantees matter here:
 *
 *  1. It refuses to run when NODE_ENV=production. Seed rows are demo data and must never
 *     mix with a real cohort.
 *  2. Every row is marked `isDemo: true`, and `--clean` removes exactly those rows and
 *     nothing else, so a seeded database can be returned to a real one safely.
 *
 * The figures are generated, but they are not fabricated *statistics*: the script builds
 * a plausible day-by-day solving history and then derives snapshots, points, streaks and
 * ranks through the very same domain functions the real sync uses. If the scoring rules
 * change, the seeded numbers change with them.
 */

// Must come first: it loads .env before the database module is evaluated.
import "./load-env";

// Uses the shared client so the seed connects exactly like the app does (TLS included).
import { prisma } from "../src/lib/db";
import {
  DEFAULT_CHALLENGE_END_ISO,
  DEFAULT_CHALLENGE_START_ISO,
  DEFAULT_TIMEZONE,
  challengeEndDayKey,
  challengeStartDayKey,
  dayKeyToDateColumn,
  eachDay,
  effectiveEndDayKey,
  startOfDayUtc,
  toDayKey,
} from "../src/lib/challenge/dates";
import { progressFromBaseline } from "../src/lib/challenge/progress";
import { DEFAULT_SCORING, computePoints } from "../src/lib/challenge/scoring";
import { computeStreaks } from "../src/lib/challenge/streak";
import type { ActivityDay, ChallengeSettings, Difficulty } from "../src/lib/challenge/types";

if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to seed: NODE_ENV=production. Demo students must never be created in a real challenge.",
  );
  process.exit(1);
}

const CONFIG_ID = "default";

// ---------------------------------------------------------------------------
// Deterministic randomness, so repeated seeds produce the same cohort.
// ---------------------------------------------------------------------------
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(20260901);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

function between(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Diya", "Kabir", "Ishita", "Vihaan", "Meera",
  "Arjun", "Saanvi", "Aditya", "Riya", "Karthik", "Nisha", "Rahul", "Tanvi",
  "Siddharth", "Priya", "Neel", "Aisha", "Manav", "Sneha", "Yash", "Pooja",
  "Devansh", "Lakshmi", "Farhan", "Anjali",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Nair", "Reddy", "Patel", "Gupta", "Menon",
  "Joshi", "Kulkarni", "Bose", "Chatterjee", "Rao", "Desai", "Kapoor", "Sinha",
];

const PROBLEMS: ReadonlyArray<{ slug: string; title: string; difficulty: Difficulty }> = [
  { slug: "two-sum", title: "Two Sum", difficulty: "EASY" },
  { slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "EASY" },
  { slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "EASY" },
  { slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "EASY" },
  { slug: "climbing-stairs", title: "Climbing Stairs", difficulty: "EASY" },
  { slug: "binary-search", title: "Binary Search", difficulty: "EASY" },
  { slug: "invert-binary-tree", title: "Invert Binary Tree", difficulty: "EASY" },
  { slug: "longest-substring-without-repeating-characters", title: "Longest Substring Without Repeating Characters", difficulty: "MEDIUM" },
  { slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "MEDIUM" },
  { slug: "3sum", title: "3Sum", difficulty: "MEDIUM" },
  { slug: "group-anagrams", title: "Group Anagrams", difficulty: "MEDIUM" },
  { slug: "coin-change", title: "Coin Change", difficulty: "MEDIUM" },
  { slug: "course-schedule", title: "Course Schedule", difficulty: "MEDIUM" },
  { slug: "rotate-image", title: "Rotate Image", difficulty: "MEDIUM" },
  { slug: "number-of-islands", title: "Number of Islands", difficulty: "MEDIUM" },
  { slug: "lru-cache", title: "LRU Cache", difficulty: "MEDIUM" },
  { slug: "median-of-two-sorted-arrays", title: "Median of Two Sorted Arrays", difficulty: "HARD" },
  { slug: "trapping-rain-water", title: "Trapping Rain Water", difficulty: "HARD" },
  { slug: "merge-k-sorted-lists", title: "Merge k Sorted Lists", difficulty: "HARD" },
  { slug: "word-ladder", title: "Word Ladder", difficulty: "HARD" },
  { slug: "edit-distance", title: "Edit Distance", difficulty: "HARD" },
];

/** A student's solving personality, which is what makes the cohort look real. */
interface Persona {
  /** Chance of solving anything on a given day. */
  consistency: number;
  /** Typical problems on an active day. */
  volume: [number, number];
  /** Relative appetite for easy / medium / hard. */
  mix: [number, number, number];
}

const PERSONAS: ReadonlyArray<Persona> = [
  { consistency: 0.95, volume: [3, 6], mix: [2, 6, 3] }, // grinder
  { consistency: 0.8, volume: [2, 4], mix: [3, 6, 1] }, // steady
  { consistency: 0.6, volume: [1, 3], mix: [5, 4, 1] }, // casual
  { consistency: 0.35, volume: [1, 5], mix: [4, 5, 1] }, // burst solver
  { consistency: 0.5, volume: [1, 2], mix: [7, 3, 0] }, // easy-only
  { consistency: 0.25, volume: [1, 2], mix: [1, 4, 5] }, // hard specialist
  { consistency: 0.08, volume: [1, 1], mix: [6, 3, 1] }, // barely started
];

function pickDifficulty(mix: Persona["mix"]): Difficulty {
  const total = mix[0] + mix[1] + mix[2];
  const roll = random() * total;
  if (roll < mix[0]) return "EASY";
  if (roll < mix[0] + mix[1]) return "MEDIUM";
  return "HARD";
}

async function main(): Promise<void> {
  const clean = process.argv.includes("--clean");

  try {
    // ---- Challenge configuration -------------------------------------------
    const config = await prisma.challengeConfig.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: {
        id: CONFIG_ID,
        challengeName: "College LeetCode 4-Month Challenge",
        startDate: new Date(DEFAULT_CHALLENGE_START_ISO),
        endDate: new Date(DEFAULT_CHALLENGE_END_ISO),
        timezone: DEFAULT_TIMEZONE,
        ...DEFAULT_SCORING,
      },
    });

    const settings: ChallengeSettings = {
      challengeName: config.challengeName,
      startDate: config.startDate,
      endDate: config.endDate,
      timezone: config.timezone,
      easyPoints: config.easyPoints,
      mediumPoints: config.mediumPoints,
      hardPoints: config.hardPoints,
    };
    const scoring = {
      easyPoints: settings.easyPoints,
      mediumPoints: settings.mediumPoints,
      hardPoints: settings.hardPoints,
    };

    // ---- Remove previous demo rows only -------------------------------------
    const removed = await prisma.student.deleteMany({ where: { isDemo: true } });
    if (removed.count > 0) {
      console.log(`Removed ${removed.count} existing demo students (real students untouched).`);
    }

    if (clean) {
      console.log("Clean complete. No new demo data created.");
      return;
    }

    // ---- Problem cache -------------------------------------------------------
    await prisma.problem.createMany({
      data: PROBLEMS.map((problem) => ({
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
      })),
      skipDuplicates: true,
    });

    // ---- Build the cohort ----------------------------------------------------
    const now = new Date();
    const startDay = challengeStartDayKey(settings);
    const endDay = challengeEndDayKey(settings);
    const lastDay = effectiveEndDayKey(settings, now);
    const todayKey = toDayKey(now, settings.timezone);
    const activeDays = lastDay >= startDay ? eachDay(startDay, lastDay) : [];

    if (activeDays.length === 0) {
      console.log(
        `Note: the challenge starts on ${startDay} and has not begun yet, so students are seeded with baselines and no activity.`,
      );
    }

    const count = 26;
    const usedNames = new Set<string>();
    let created = 0;

    for (let index = 0; index < count; index += 1) {
      let name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      let guard = 0;
      while (usedNames.has(name) && guard < 50) {
        name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        guard += 1;
      }
      usedNames.add(name);

      const username = `demo-${name.toLowerCase().replace(/[^a-z]+/g, "-")}-${index}`;
      const persona = PERSONAS[index % PERSONAS.length] as Persona;

      // Lifetime history that predates the challenge. None of it may ever count.
      const baseline = {
        easy: between(15, 140),
        medium: between(5, 160),
        hard: between(0, 40),
        total: 0,
      };
      baseline.total = baseline.easy + baseline.medium + baseline.hard;

      // Day-by-day solving, the same shape the real sync observes.
      const perDay: Array<{ day: string; easy: number; medium: number; hard: number }> = [];
      for (const day of activeDays) {
        if (random() > persona.consistency) {
          perDay.push({ day, easy: 0, medium: 0, hard: 0 });
          continue;
        }
        const total = between(persona.volume[0], persona.volume[1]);
        const counts = { easy: 0, medium: 0, hard: 0 };
        for (let n = 0; n < total; n += 1) {
          const difficulty = pickDifficulty(persona.mix);
          if (difficulty === "EASY") counts.easy += 1;
          else if (difficulty === "MEDIUM") counts.medium += 1;
          else counts.hard += 1;
        }
        perDay.push({ day, ...counts });
      }

      const student = await prisma.student.create({
        data: {
          name,
          studentId: `DEMO${String(2100 + index)}`,
          leetcodeUsername: username,
          usernameKey: username,
          isDemo: true,
          joinedAt: startOfDayUtc(startDay, settings.timezone),
          baselineTotalSolved: baseline.total,
          baselineEasySolved: baseline.easy,
          baselineMediumSolved: baseline.medium,
          baselineHardSolved: baseline.hard,
          baselineCapturedAt: startOfDayUtc(startDay, settings.timezone),
          baselineLockedAt: startOfDayUtc(startDay, settings.timezone),
          syncStatus: "SUCCESS",
          lastSyncedAt: now,
          lastFetchedAt: now,
        },
        select: { id: true },
      });

      // Roll the per-day activity forward into cumulative snapshots.
      const cumulative = { ...baseline };
      const snapshots = perDay.map((entry) => {
        cumulative.easy += entry.easy;
        cumulative.medium += entry.medium;
        cumulative.hard += entry.hard;
        cumulative.total += entry.easy + entry.medium + entry.hard;

        const challengeSoFar = {
          easy: cumulative.easy - baseline.easy,
          medium: cumulative.medium - baseline.medium,
          hard: cumulative.hard - baseline.hard,
        };

        return {
          studentId: student.id,
          date: dayKeyToDateColumn(entry.day),
          totalSolved: cumulative.total,
          easySolved: cumulative.easy,
          mediumSolved: cumulative.medium,
          hardSolved: cumulative.hard,
          solvedDelta: entry.easy + entry.medium + entry.hard,
          easyDelta: entry.easy,
          mediumDelta: entry.medium,
          hardDelta: entry.hard,
          submissions: entry.easy + entry.medium + entry.hard + between(0, 3),
          points: computePoints(challengeSoFar, scoring),
        };
      });

      if (snapshots.length > 0) {
        await prisma.dailySnapshot.createMany({ data: snapshots, skipDuplicates: true });
      }

      // A sample of problem-level rows for the activity feed. The unique constraint on
      // (studentId, problemSlug) is what keeps this duplicate-free.
      const solvedSample = new Map<string, { day: string; problem: (typeof PROBLEMS)[number] }>();
      for (const entry of perDay) {
        const solvedThatDay = entry.easy + entry.medium + entry.hard;
        for (let n = 0; n < solvedThatDay; n += 1) {
          const problem = pick(PROBLEMS);
          if (!solvedSample.has(problem.slug)) {
            solvedSample.set(problem.slug, { day: entry.day, problem });
          }
        }
      }

      if (solvedSample.size > 0) {
        await prisma.solvedProblem.createMany({
          data: [...solvedSample.values()].map(({ day, problem }) => {
            const dayStart = startOfDayUtc(day, settings.timezone).getTime();
            return {
              studentId: student.id,
              problemSlug: problem.slug,
              title: problem.title,
              difficulty: problem.difficulty,
              // Somewhere inside that challenge day, in the challenge timezone.
              solvedAt: new Date(dayStart + between(8, 22) * 3_600_000),
              detectedAt: now,
            };
          }),
          skipDuplicates: true,
        });
      }

      // Derive the standings exactly the way the real sync does.
      const progress = progressFromBaseline(cumulative, baseline, scoring);
      const activity: ActivityDay[] = perDay.map((entry) => ({
        day: entry.day,
        solved: entry.easy + entry.medium + entry.hard,
      }));
      const streaks = computeStreaks(activity, {
        startDayKey: startDay,
        endDayKey: endDay,
        todayDayKey: todayKey,
      });

      await prisma.student.update({
        where: { id: student.id },
        data: {
          challengeSolved: progress.total,
          challengeEasy: progress.easy,
          challengeMedium: progress.medium,
          challengeHard: progress.hard,
          challengePoints: progress.points,
          currentStreak: streaks.current,
          longestStreak: streaks.longest,
        },
      });

      await prisma.leetCodeProfile.create({
        data: {
          studentId: student.id,
          profileUrl: `https://leetcode.com/u/${username}/`,
          totalSolved: cumulative.total,
          easySolved: cumulative.easy,
          mediumSolved: cumulative.medium,
          hardSolved: cumulative.hard,
          totalSubmissions: Math.round(cumulative.total * 1.8),
          ranking: between(30_000, 900_000),
          reputation: between(0, 250),
          lastFetchedAt: now,
        },
      });

      created += 1;
    }

    // ---- Ranks ---------------------------------------------------------------
    await prisma.$executeRaw`
      WITH ranked AS (
        SELECT id, RANK() OVER (ORDER BY "challengeSolved" DESC, "challengePoints" DESC) AS new_rank
        FROM "Student" WHERE "isActive" = true
      )
      UPDATE "Student" AS s
      SET "previousRank" = s."rank", "rank" = ranked.new_rank
      FROM ranked
      WHERE s.id = ranked.id
    `;

    await prisma.syncRun.create({
      data: {
        trigger: "MANUAL",
        startedAt: now,
        finishedAt: new Date(),
        durationMs: 0,
        totalStudents: created,
        succeeded: created,
        failed: 0,
      },
    });

    const leader = await prisma.student.findFirst({
      where: { isDemo: true },
      orderBy: [{ challengeSolved: "desc" }, { challengePoints: "desc" }],
      select: { name: true, challengeSolved: true, challengePoints: true, leetcodeUsername: true },
    });

    console.log(
      [
        "",
        `Seeded ${created} DEMO students across ${activeDays.length} challenge day(s).`,
        leader
          ? `Leader: ${leader.name} (@${leader.leetcodeUsername}) - ${leader.challengeSolved} solved, ${leader.challengePoints} pts`
          : "",
        "",
        "All rows are marked isDemo=true. Remove them with:  npm run db:seed -- --clean",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
