import { describe, expect, it } from "vitest";

import {
  addDays,
  challengeEndDayKey,
  challengeMonths,
  challengePhase,
  challengeStartDayKey,
  challengeTimeline,
  challengeTotalDays,
  dateColumnToDayKey,
  dayKeyToDateColumn,
  daysBetween,
  eachDay,
  effectiveEndDayKey,
  endOfDayUtc,
  isWithinChallenge,
  startOfDayUtc,
  toDayKey,
} from "./dates";
import type { ChallengeWindow } from "./types";

// The real challenge window. Note the UTC instants: Asia/Kolkata is UTC+05:30, so the
// challenge opens at 18:30 UTC on 31 August and closes at 18:29:59.999 UTC on 31 December.
const WINDOW: ChallengeWindow = {
  startDate: new Date("2026-09-01T00:00:00+05:30"),
  endDate: new Date("2026-12-31T23:59:59.999+05:30"),
  timezone: "Asia/Kolkata",
};

// These tests run with TZ=UTC (see vitest.config.ts) precisely so that any accidental
// reliance on the host's local timezone shows up as a failure.
describe("timezone conversion (Asia/Kolkata)", () => {
  it("maps the challenge start instant to 1 September, not 31 August", () => {
    expect(WINDOW.startDate.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(toDayKey(WINDOW.startDate, "Asia/Kolkata")).toBe("2026-09-01");
    // The same instant is still August in UTC. This is the off-by-one-day trap.
    expect(toDayKey(WINDOW.startDate, "UTC")).toBe("2026-08-31");
  });

  it("maps the challenge end instant to 31 December", () => {
    expect(WINDOW.endDate.toISOString()).toBe("2026-12-31T18:29:59.999Z");
    expect(toDayKey(WINDOW.endDate, "Asia/Kolkata")).toBe("2026-12-31");
  });

  it("rolls over the day at 18:30 UTC", () => {
    expect(toDayKey(new Date("2026-09-01T18:29:59.999Z"), "Asia/Kolkata")).toBe("2026-09-01");
    expect(toDayKey(new Date("2026-09-01T18:30:00.000Z"), "Asia/Kolkata")).toBe("2026-09-02");
  });

  it("round-trips a day key through its UTC start instant", () => {
    const start = startOfDayUtc("2026-09-01", "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(toDayKey(start, "Asia/Kolkata")).toBe("2026-09-01");
  });

  it("ends a day one millisecond before the next begins", () => {
    const end = endOfDayUtc("2026-09-01", "Asia/Kolkata");
    expect(end.toISOString()).toBe("2026-09-01T18:29:59.999Z");
    expect(toDayKey(end, "Asia/Kolkata")).toBe("2026-09-01");
    expect(end.getTime() + 1).toBe(startOfDayUtc("2026-09-02", "Asia/Kolkata").getTime());
  });

  it("stores and reads date-only columns without shifting the day", () => {
    const column = dayKeyToDateColumn("2026-09-01");
    expect(column.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(dateColumnToDayKey(column)).toBe("2026-09-01");
  });
});

describe("challenge boundaries", () => {
  it("excludes the instant just before the challenge opens", () => {
    expect(isWithinChallenge(new Date("2026-08-31T18:29:59.999Z"), WINDOW)).toBe(false);
  });

  it("includes the exact opening instant", () => {
    expect(isWithinChallenge(new Date("2026-08-31T18:30:00.000Z"), WINDOW)).toBe(true);
  });

  it("includes the exact closing instant", () => {
    expect(isWithinChallenge(new Date("2026-12-31T18:29:59.999Z"), WINDOW)).toBe(true);
  });

  it("excludes the instant just after the challenge closes", () => {
    expect(isWithinChallenge(new Date("2026-12-31T18:30:00.000Z"), WINDOW)).toBe(false);
  });

  it("excludes an August solve that is already September in UTC terms", () => {
    // 31 Aug 2026 23:00 IST is still before the challenge.
    expect(isWithinChallenge(new Date("2026-08-31T17:30:00Z"), WINDOW)).toBe(false);
  });

  it("reports the correct first and last challenge days", () => {
    expect(challengeStartDayKey(WINDOW)).toBe("2026-09-01");
    expect(challengeEndDayKey(WINDOW)).toBe("2026-12-31");
  });

  it("spans 122 days (30 + 31 + 30 + 31)", () => {
    expect(challengeTotalDays(WINDOW)).toBe(122);
  });
});

describe("day key arithmetic", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("measures the gap between two days", () => {
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
    expect(daysBetween("2026-09-01", "2026-12-31")).toBe(121);
    expect(daysBetween("2026-12-31", "2026-09-01")).toBe(-121);
  });

  it("enumerates an inclusive range", () => {
    expect(eachDay("2026-09-01", "2026-09-04")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
    expect(eachDay("2026-09-04", "2026-09-01")).toEqual([]);
  });
});

describe("challenge timeline", () => {
  it("reports BEFORE ahead of the start", () => {
    const now = new Date("2026-08-20T10:00:00Z");
    expect(challengePhase(WINDOW, now)).toBe("BEFORE");
    const timeline = challengeTimeline(WINDOW, now);
    expect(timeline.daysElapsed).toBe(0);
    expect(timeline.daysRemaining).toBe(122);
  });

  it("counts the opening day as day one", () => {
    const now = new Date("2026-09-01T06:00:00+05:30");
    const timeline = challengeTimeline(WINDOW, now);
    expect(timeline.phase).toBe("ACTIVE");
    expect(timeline.daysElapsed).toBe(1);
    expect(timeline.daysRemaining).toBe(121);
  });

  it("reports ENDED after the close and leaves nothing remaining", () => {
    const now = new Date("2027-01-05T00:00:00Z");
    const timeline = challengeTimeline(WINDOW, now);
    expect(timeline.phase).toBe("ENDED");
    expect(timeline.daysElapsed).toBe(122);
    expect(timeline.daysRemaining).toBe(0);
    expect(timeline.progress).toBe(1);
  });

  it("clamps the effective end day to the challenge close", () => {
    expect(effectiveEndDayKey(WINDOW, new Date("2026-10-05T12:00:00+05:30"))).toBe("2026-10-05");
    expect(effectiveEndDayKey(WINDOW, new Date("2027-03-01T12:00:00+05:30"))).toBe("2026-12-31");
  });
});

describe("month buckets", () => {
  it("produces September through December with correct edges", () => {
    const months = challengeMonths(WINDOW);
    expect(months.map((month) => month.label)).toEqual([
      "September",
      "October",
      "November",
      "December",
    ]);
    expect(months[0]).toMatchObject({ firstDay: "2026-09-01", lastDay: "2026-09-30" });
    expect(months[3]).toMatchObject({ firstDay: "2026-12-01", lastDay: "2026-12-31" });
  });
});
