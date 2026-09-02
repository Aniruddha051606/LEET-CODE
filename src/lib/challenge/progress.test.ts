import { describe, expect, it } from "vitest";

import {
  filterWithinChallenge,
  progressFromBaseline,
  progressFromProblems,
  shouldLockBaseline,
  shouldRebaseBaseline,
} from "./progress";
import { DEFAULT_SCORING } from "./scoring";
import type { ChallengeWindow, SolvedAt } from "./types";

const WINDOW: ChallengeWindow = {
  startDate: new Date("2026-09-01T00:00:00+05:30"),
  endDate: new Date("2026-12-31T23:59:59.999+05:30"),
  timezone: "Asia/Kolkata",
};

function solved(slug: string, difficulty: SolvedAt["difficulty"], iso: string): SolvedAt {
  return { problemSlug: slug, difficulty, solvedAt: new Date(iso) };
}

describe("progress from baseline", () => {
  it("counts only what was solved after the baseline was captured", () => {
    // The worked example from the brief: 137 lifetime at join, 158 on 15 September.
    const baseline = { total: 137, easy: 70, medium: 55, hard: 12 };
    const current = { total: 158, easy: 78, medium: 66, hard: 14 };

    const progress = progressFromBaseline(current, baseline, DEFAULT_SCORING);

    expect(progress.total).toBe(21);
    expect(progress).toMatchObject({ easy: 8, medium: 11, hard: 2 });
    expect(progress.points).toBe(8 * 1 + 11 * 3 + 2 * 5);
  });

  it("reports zero for a student who has not solved anything since joining", () => {
    const baseline = { total: 137, easy: 70, medium: 55, hard: 12 };
    const progress = progressFromBaseline(
      { total: 137, easy: 70, medium: 55, hard: 12 },
      baseline,
      DEFAULT_SCORING,
    );

    expect(progress).toMatchObject({ total: 0, easy: 0, medium: 0, hard: 0, points: 0 });
  });

  it("never goes negative when LeetCode retires a problem and a lifetime count drops", () => {
    const baseline = { total: 137, easy: 70, medium: 55, hard: 12 };
    const progress = progressFromBaseline(
      { total: 130, easy: 66, medium: 52, hard: 12 },
      baseline,
      DEFAULT_SCORING,
    );

    expect(progress).toMatchObject({ total: 0, easy: 0, medium: 0, hard: 0, points: 0 });
  });

  it("is immune to re-solving, because lifetime counters are distinct-problem counts", () => {
    // Solving an already-solved problem does not move acSubmissionNum, so the delta
    // stays put no matter how many times it is submitted.
    const baseline = { total: 100, easy: 50, medium: 40, hard: 10 };
    const afterResolvingOldProblems = { total: 100, easy: 50, medium: 40, hard: 10 };

    expect(
      progressFromBaseline(afterResolvingOldProblems, baseline, DEFAULT_SCORING).total,
    ).toBe(0);
  });
});

describe("challenge boundaries applied to problem-level data", () => {
  const problems: SolvedAt[] = [
    // Before the challenge opens (31 August, 23:00 IST).
    solved("pre-challenge", "HARD", "2026-08-31T17:30:00Z"),
    // Exactly at the opening instant.
    solved("opening-instant", "EASY", "2026-08-31T18:30:00.000Z"),
    // Comfortably inside.
    solved("mid-challenge", "MEDIUM", "2026-10-15T09:00:00Z"),
    // Exactly at the closing instant.
    solved("closing-instant", "MEDIUM", "2026-12-31T18:29:59.999Z"),
    // Just after the challenge closes (1 January, 00:00 IST).
    solved("post-challenge", "HARD", "2026-12-31T18:30:00.000Z"),
  ];

  it("excludes problems solved before the challenge", () => {
    const kept = filterWithinChallenge(problems, WINDOW).map((p) => p.problemSlug);
    expect(kept).not.toContain("pre-challenge");
  });

  it("includes problems solved during the challenge, boundaries inclusive", () => {
    const kept = filterWithinChallenge(problems, WINDOW).map((p) => p.problemSlug);
    expect(kept).toEqual(["opening-instant", "mid-challenge", "closing-instant"]);
  });

  it("excludes problems solved after the challenge", () => {
    const kept = filterWithinChallenge(problems, WINDOW).map((p) => p.problemSlug);
    expect(kept).not.toContain("post-challenge");
  });

  it("scores only the in-window problems", () => {
    const progress = progressFromProblems(problems, WINDOW, DEFAULT_SCORING);
    expect(progress).toMatchObject({ total: 3, easy: 1, medium: 2, hard: 0 });
    expect(progress.points).toBe(1 * 1 + 2 * 3);
  });
});

describe("duplicate problems", () => {
  it("counts the same problem once no matter how many times it was solved", () => {
    const problems = [
      solved("two-sum", "EASY", "2026-09-02T10:00:00Z"),
      solved("two-sum", "EASY", "2026-09-09T10:00:00Z"),
      solved("two-sum", "EASY", "2026-10-01T10:00:00Z"),
    ];

    const progress = progressFromProblems(problems, WINDOW, DEFAULT_SCORING);

    expect(progress.total).toBe(1);
    expect(progress.easy).toBe(1);
    expect(progress.points).toBe(1);
  });

  it("still counts distinct problems separately", () => {
    const problems = [
      solved("two-sum", "EASY", "2026-09-02T10:00:00Z"),
      solved("two-sum", "EASY", "2026-09-03T10:00:00Z"),
      solved("3sum", "MEDIUM", "2026-09-04T10:00:00Z"),
    ];

    const progress = progressFromProblems(problems, WINDOW, DEFAULT_SCORING);
    expect(progress).toMatchObject({ total: 2, easy: 1, medium: 1 });
    expect(progress.points).toBe(1 + 3);
  });

  it("counts a problem whose difficulty is unresolved in the total but not in the points", () => {
    const problems = [solved("mystery", null, "2026-09-02T10:00:00Z")];
    const progress = progressFromProblems(problems, WINDOW, DEFAULT_SCORING);

    expect(progress.total).toBe(1);
    expect(progress.points).toBe(0);
  });
});

describe("baseline locking", () => {
  const beforeStart = new Date("2026-08-20T10:00:00Z");
  const afterStart = new Date("2026-09-02T10:00:00Z");

  it("keeps re-basing while the challenge has not started", () => {
    expect(shouldRebaseBaseline(WINDOW, null, beforeStart)).toBe(true);
    expect(shouldLockBaseline(WINDOW, null, beforeStart)).toBe(false);
  });

  it("locks the baseline on the first sync once the challenge is open", () => {
    expect(shouldRebaseBaseline(WINDOW, null, afterStart)).toBe(false);
    expect(shouldLockBaseline(WINDOW, null, afterStart)).toBe(true);
  });

  it("never re-bases or re-locks a baseline that is already locked", () => {
    const lockedAt = new Date("2026-09-01T00:00:00Z");
    expect(shouldRebaseBaseline(WINDOW, lockedAt, afterStart)).toBe(false);
    expect(shouldLockBaseline(WINDOW, lockedAt, afterStart)).toBe(false);
  });
});
