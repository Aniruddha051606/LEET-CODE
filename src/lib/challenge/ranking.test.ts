import { describe, expect, it } from "vitest";

import { gapToNextRank, rankChange, rankStudents, topPercentile, type Rankable } from "./ranking";

function student(
  id: string,
  challengeSolved: number,
  challengePoints: number,
  joinedAt = "2026-09-01T00:00:00Z",
): Rankable {
  return { id, challengeSolved, challengePoints, joinedAt: new Date(joinedAt) };
}

describe("leaderboard ranking", () => {
  it("ranks by problems solved during the challenge first", () => {
    const ranked = rankStudents([
      student("low", 5, 500),
      student("high", 20, 20),
      student("mid", 12, 100),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["high", "mid", "low"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("breaks ties on solved count using challenge points", () => {
    const ranked = rankStudents([
      student("fewer-points", 10, 18),
      student("more-points", 10, 34),
    ]);

    expect(ranked[0]).toMatchObject({ id: "more-points", rank: 1 });
    expect(ranked[1]).toMatchObject({ id: "fewer-points", rank: 2 });
  });

  it("never ranks by lifetime totals, only by challenge progress", () => {
    // Both students are level on the challenge; a huge lifetime history is irrelevant
    // because it is not part of the Rankable shape at all.
    const ranked = rankStudents([student("veteran", 3, 9), student("newcomer", 8, 8)]);
    expect(ranked[0]?.id).toBe("newcomer");
  });

  it("gives tied students the same rank and skips the next one", () => {
    const ranked = rankStudents([
      student("a", 10, 30),
      student("b", 10, 30),
      student("c", 4, 12),
    ]);

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it("breaks a complete tie in favour of whoever joined first", () => {
    const ranked = rankStudents([
      student("late", 10, 30, "2026-09-20T00:00:00Z"),
      student("early", 10, 30, "2026-09-01T00:00:00Z"),
    ]);

    expect(ranked[0]?.id).toBe("early");
    // They are genuinely tied, so they share rank 1 even though one is listed first.
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1]);
  });

  it("handles an empty field", () => {
    expect(rankStudents([])).toEqual([]);
  });
});

describe("rank movement", () => {
  it("reports an improvement as UP with the number of places gained", () => {
    expect(rankChange(3, 7)).toEqual({ movement: "UP", delta: 4 });
  });

  it("reports a drop as DOWN", () => {
    expect(rankChange(9, 5)).toEqual({ movement: "DOWN", delta: -4 });
  });

  it("reports no change", () => {
    expect(rankChange(5, 5)).toEqual({ movement: "SAME", delta: 0 });
  });

  it("reports a student with no previous rank as NEW", () => {
    expect(rankChange(5, null)).toEqual({ movement: "NEW", delta: 0 });
    expect(rankChange(null, null)).toEqual({ movement: "NEW", delta: 0 });
  });
});

describe("percentile and gaps", () => {
  it("puts rank 1 of 100 in the top 1 percent", () => {
    expect(topPercentile(1, 100)).toBe(1);
  });

  it("puts rank 10 of 100 in the top 10 percent", () => {
    expect(topPercentile(10, 100)).toBe(10);
  });

  it("puts the last student in the top 100 percent", () => {
    expect(topPercentile(40, 40)).toBe(100);
  });

  it("says how many problems are needed to overtake the student above", () => {
    // Trailing by 3 problems: matching them is not enough, so it takes 4.
    expect(gapToNextRank({ challengeSolved: 12, challengePoints: 30 }, { challengeSolved: 15, challengePoints: 40 })).toBe(4);
  });

  it("needs a single problem when level on problems but behind on points", () => {
    expect(gapToNextRank({ challengeSolved: 15, challengePoints: 30 }, { challengeSolved: 15, challengePoints: 45 })).toBe(1);
  });

  it("returns null for the student in first place", () => {
    expect(gapToNextRank({ challengeSolved: 40, challengePoints: 120 }, null)).toBeNull();
  });
});
