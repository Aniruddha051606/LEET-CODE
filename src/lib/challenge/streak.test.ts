import { describe, expect, it } from "vitest";

import { busiestDay, computeStreaks, densifyActivity } from "./streak";
import type { ActivityDay } from "./types";

const BOUNDS = {
  startDayKey: "2026-09-01",
  endDayKey: "2026-12-31",
  todayDayKey: "2026-09-10",
};

function days(...entries: Array<[string, number]>): ActivityDay[] {
  return entries.map(([day, solved]) => ({ day, solved }));
}

describe("current streak", () => {
  it("counts consecutive days ending today", () => {
    const activity = days(
      ["2026-09-07", 1],
      ["2026-09-08", 3],
      ["2026-09-09", 1],
      ["2026-09-10", 2],
    );

    expect(computeStreaks(activity, BOUNDS).current).toBe(4);
  });

  it("resets to zero when a day in the middle was missed", () => {
    const activity = days(
      ["2026-09-06", 2],
      ["2026-09-07", 2],
      // 8 September missed
      ["2026-09-09", 1],
      ["2026-09-10", 1],
    );

    expect(computeStreaks(activity, BOUNDS).current).toBe(2);
  });

  it("survives an unsolved today, because today is still in progress", () => {
    const activity = days(["2026-09-08", 1], ["2026-09-09", 1]);
    expect(computeStreaks(activity, BOUNDS).current).toBe(2);
  });

  it("is broken once both today and yesterday are missed", () => {
    const activity = days(["2026-09-06", 1], ["2026-09-07", 1]);
    expect(computeStreaks(activity, BOUNDS).current).toBe(0);
  });

  it("treats several solves on one day as a single streak day", () => {
    const activity = days(["2026-09-09", 9], ["2026-09-10", 7]);
    expect(computeStreaks(activity, BOUNDS).current).toBe(2);
  });

  it("does not count days before the challenge started", () => {
    const activity = days(
      ["2026-08-30", 5],
      ["2026-08-31", 5],
      ["2026-09-01", 1],
    );

    const result = computeStreaks(activity, {
      ...BOUNDS,
      todayDayKey: "2026-09-01",
    });

    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });

  it("measures to the final day once the challenge has ended", () => {
    const activity = days(["2026-12-29", 1], ["2026-12-30", 1], ["2026-12-31", 1]);

    const result = computeStreaks(activity, {
      ...BOUNDS,
      todayDayKey: "2027-01-15",
    });

    // The streak is the run ending on 31 December, not zero because "today" is in January.
    expect(result.current).toBe(3);
  });

  it("ignores activity recorded after the challenge ended", () => {
    const activity = days(["2026-12-31", 1], ["2027-01-01", 5], ["2027-01-02", 5]);

    const result = computeStreaks(activity, { ...BOUNDS, todayDayKey: "2027-01-02" });

    // Ten problems solved in January contribute nothing: only 31 December is counted,
    // and the final streak is the one-day run ending on the last challenge day.
    expect(result.activeDays).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.current).toBe(1);
  });

  it("does not let post-challenge solves extend a streak", () => {
    // Without the window clamp, 30 and 31 December plus two January days would read as
    // a four-day streak. It must stay at two.
    const activity = days(
      ["2026-12-30", 1],
      ["2026-12-31", 1],
      ["2027-01-01", 1],
      ["2027-01-02", 1],
    );

    const result = computeStreaks(activity, { ...BOUNDS, todayDayKey: "2027-01-02" });

    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
  });

  it("returns zero for a student with no activity at all", () => {
    expect(computeStreaks([], BOUNDS)).toEqual({ current: 0, longest: 0, activeDays: 0 });
  });

  it("ignores days recorded with zero solves", () => {
    const activity = days(["2026-09-09", 0], ["2026-09-10", 0]);
    expect(computeStreaks(activity, BOUNDS)).toEqual({ current: 0, longest: 0, activeDays: 0 });
  });
});

describe("longest streak", () => {
  it("finds the best run anywhere in the challenge", () => {
    const activity = days(
      ["2026-09-01", 1],
      ["2026-09-02", 1],
      ["2026-09-03", 1],
      ["2026-09-04", 1],
      ["2026-09-05", 1],
      // gap
      ["2026-09-09", 1],
      ["2026-09-10", 1],
    );

    const result = computeStreaks(activity, BOUNDS);
    expect(result.longest).toBe(5);
    expect(result.current).toBe(2);
  });

  it("spans a month boundary", () => {
    const activity = days(
      ["2026-09-29", 1],
      ["2026-09-30", 1],
      ["2026-10-01", 1],
      ["2026-10-02", 1],
    );

    expect(computeStreaks(activity, { ...BOUNDS, todayDayKey: "2026-10-02" }).longest).toBe(4);
  });

  it("counts a solitary active day as a streak of one", () => {
    expect(computeStreaks(days(["2026-09-04", 3]), BOUNDS).longest).toBe(1);
  });
});

describe("densifying activity", () => {
  it("fills in days that were never recorded", () => {
    const filled = densifyActivity(days(["2026-09-02", 4]), "2026-09-01", "2026-09-03");

    expect(filled).toEqual([
      { day: "2026-09-01", solved: 0, submissions: 0 },
      { day: "2026-09-02", solved: 4, submissions: 0 },
      { day: "2026-09-03", solved: 0, submissions: 0 },
    ]);
  });
});

describe("busiest day", () => {
  it("returns the day with the most solves", () => {
    const activity = days(["2026-09-01", 2], ["2026-09-02", 9], ["2026-09-03", 4]);
    expect(busiestDay(activity)?.day).toBe("2026-09-02");
  });

  it("breaks ties towards the earlier day so the answer is stable", () => {
    const activity = days(["2026-09-03", 5], ["2026-09-01", 5]);
    expect(busiestDay(activity)?.day).toBe("2026-09-01");
  });

  it("returns null when nothing was solved", () => {
    expect(busiestDay(days(["2026-09-01", 0]))).toBeNull();
  });
});
