import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCORING,
  computePoints,
  isValidScoring,
  pointsForDifficulty,
  tallyDifficulties,
  totalOf,
} from "./scoring";

describe("default scoring", () => {
  it("awards 1 / 3 / 5 for easy / medium / hard", () => {
    expect(DEFAULT_SCORING).toEqual({ easyPoints: 1, mediumPoints: 3, hardPoints: 5 });
    expect(pointsForDifficulty("EASY", DEFAULT_SCORING)).toBe(1);
    expect(pointsForDifficulty("MEDIUM", DEFAULT_SCORING)).toBe(3);
    expect(pointsForDifficulty("HARD", DEFAULT_SCORING)).toBe(5);
  });

  it("scores the worked example from the brief: 10E + 5M + 2H = 35", () => {
    const points = computePoints({ easy: 10, medium: 5, hard: 2 }, DEFAULT_SCORING);
    expect(points).toBe(35);
  });

  it("scores nothing for no problems", () => {
    expect(computePoints({ easy: 0, medium: 0, hard: 0 }, DEFAULT_SCORING)).toBe(0);
  });
});

describe("configurable scoring", () => {
  it("uses the supplied configuration rather than the defaults", () => {
    const scoring = { easyPoints: 2, mediumPoints: 6, hardPoints: 12 };
    expect(computePoints({ easy: 10, medium: 5, hard: 2 }, scoring)).toBe(20 + 30 + 24);
  });

  it("supports a configuration that zeroes out a difficulty", () => {
    const scoring = { easyPoints: 0, mediumPoints: 3, hardPoints: 5 };
    expect(computePoints({ easy: 50, medium: 1, hard: 0 }, scoring)).toBe(3);
  });

  it("rejects negative, fractional and absurd point values", () => {
    expect(isValidScoring({ easyPoints: 1, mediumPoints: 3, hardPoints: 5 })).toBe(true);
    expect(isValidScoring({ easyPoints: -1, mediumPoints: 3, hardPoints: 5 })).toBe(false);
    expect(isValidScoring({ easyPoints: 1.5, mediumPoints: 3, hardPoints: 5 })).toBe(false);
    expect(isValidScoring({ easyPoints: 1, mediumPoints: 3, hardPoints: 100_000 })).toBe(false);
  });
});

describe("tallies", () => {
  it("counts difficulties and ignores unresolved ones", () => {
    const counts = tallyDifficulties(["EASY", "MEDIUM", "MEDIUM", "HARD", null]);
    expect(counts).toEqual({ easy: 1, medium: 2, hard: 1 });
    expect(totalOf(counts)).toBe(4);
  });
});
