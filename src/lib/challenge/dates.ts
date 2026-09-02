/**
 * Timezone-correct date handling for the challenge.
 *
 * Every instant we store is UTC. Every *day* the challenge cares about is a calendar
 * day in the challenge timezone (Asia/Kolkata by default). Those two things are not
 * the same, and conflating them is the classic source of off-by-one-day bugs, so all
 * conversion happens here and nowhere else.
 *
 * Nothing in this module reads the host machine's local time. Day keys are derived
 * with `Intl.DateTimeFormat` against an explicit timezone, which means the server can
 * run anywhere and produce identical results.
 */

import type { ChallengeWindow, DayKey } from "./types";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Default challenge window: 1 Sep 2026 to 31 Dec 2026 inclusive, Asia/Kolkata. */
export const DEFAULT_CHALLENGE_START_ISO = "2026-09-01T00:00:00+05:30";
export const DEFAULT_CHALLENGE_END_ISO = "2026-12-31T23:59:59.999+05:30";

const MS_PER_DAY = 86_400_000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Milliseconds the given timezone is ahead of UTC at that instant. */
function timezoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    instant.getUTCMilliseconds(),
  );
  return asUtc - instant.getTime();
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** The calendar day an instant falls on, in the given timezone. */
export function toDayKey(instant: Date, timeZone: string = DEFAULT_TIMEZONE): DayKey {
  const parts = zonedParts(instant, timeZone);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function isDayKey(value: string): boolean {
  return DAY_KEY_PATTERN.test(value);
}

function assertDayKey(value: string): void {
  if (!isDayKey(value)) {
    throw new RangeError(`Invalid day key "${value}", expected YYYY-MM-DD`);
  }
}

/** The UTC instant at which the given calendar day begins in the given timezone. */
export function startOfDayUtc(dayKey: DayKey, timeZone: string = DEFAULT_TIMEZONE): Date {
  assertDayKey(dayKey);
  const naive = Date.parse(`${dayKey}T00:00:00Z`);
  // First pass uses the offset at the naive instant; the second pass corrects the rare
  // case where that guess lands on the far side of a DST transition.
  const firstPass = naive - timezoneOffsetMs(new Date(naive), timeZone);
  const secondPass = naive - timezoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

/** The last representable millisecond of the given calendar day in the given timezone. */
export function endOfDayUtc(dayKey: DayKey, timeZone: string = DEFAULT_TIMEZONE): Date {
  return new Date(startOfDayUtc(addDays(dayKey, 1), timeZone).getTime() - 1);
}

/**
 * A `Date` positioned at UTC midnight of the day key. Postgres `@db.Date` columns are
 * date-only, so this is the canonical value we store and compare against.
 */
export function dayKeyToDateColumn(dayKey: DayKey): Date {
  assertDayKey(dayKey);
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/** Reads a `@db.Date` column back into a day key without touching local time. */
export function dateColumnToDayKey(value: Date): DayKey {
  return toDayKey(value, "UTC");
}

/** Calendar arithmetic on day keys. Timezone-free by construction. */
export function addDays(dayKey: DayKey, amount: number): DayKey {
  assertDayKey(dayKey);
  const shifted = new Date(Date.parse(`${dayKey}T00:00:00Z`) + amount * MS_PER_DAY);
  return toDayKey(shifted, "UTC");
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: DayKey, to: DayKey): number {
  assertDayKey(from);
  assertDayKey(to);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** Inclusive list of every day key from `from` to `to`. Empty when `to` precedes `from`. */
export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  const days: DayKey[] = [];
  for (let index = 0; index <= span; index += 1) {
    days.push(addDays(from, index));
  }
  return days;
}

/** Day keys sort correctly as plain strings, which these helpers rely on. */
export function minDayKey(a: DayKey, b: DayKey): DayKey {
  return a <= b ? a : b;
}

export function maxDayKey(a: DayKey, b: DayKey): DayKey {
  return a >= b ? a : b;
}

// ---------------------------------------------------------------------------
// Challenge window helpers
// ---------------------------------------------------------------------------

/**
 * Is this instant inside the challenge? Boundaries are inclusive.
 *
 * This is the single gate that enforces "solved before 1 Sep does not count" and
 * "solved after 31 Dec does not count".
 */
export function isWithinChallenge(instant: Date, window: ChallengeWindow): boolean {
  const time = instant.getTime();
  return time >= window.startDate.getTime() && time <= window.endDate.getTime();
}

export function challengeStartDayKey(window: ChallengeWindow): DayKey {
  return toDayKey(window.startDate, window.timezone);
}

export function challengeEndDayKey(window: ChallengeWindow): DayKey {
  return toDayKey(window.endDate, window.timezone);
}

/** Total number of days in the challenge, inclusive of both endpoints. */
export function challengeTotalDays(window: ChallengeWindow): number {
  return daysBetween(challengeStartDayKey(window), challengeEndDayKey(window)) + 1;
}

export type ChallengePhase = "BEFORE" | "ACTIVE" | "ENDED";

export function challengePhase(window: ChallengeWindow, now: Date = new Date()): ChallengePhase {
  if (now.getTime() < window.startDate.getTime()) return "BEFORE";
  if (now.getTime() > window.endDate.getTime()) return "ENDED";
  return "ACTIVE";
}

export interface ChallengeTimeline {
  phase: ChallengePhase;
  startDayKey: DayKey;
  endDayKey: DayKey;
  /** The day the challenge is currently on, clamped to the window. */
  currentDayKey: DayKey;
  totalDays: number;
  /** Days from the start up to and including today. 0 before the challenge begins. */
  daysElapsed: number;
  /** Days from tomorrow to the end. 0 once the challenge has ended. */
  daysRemaining: number;
  /** 0-1 fraction of the challenge that has passed. */
  progress: number;
}

export function challengeTimeline(window: ChallengeWindow, now: Date = new Date()): ChallengeTimeline {
  const startDayKey = challengeStartDayKey(window);
  const endDayKey = challengeEndDayKey(window);
  const totalDays = challengeTotalDays(window);
  const phase = challengePhase(window, now);
  const todayKey = toDayKey(now, window.timezone);
  const currentDayKey = minDayKey(maxDayKey(todayKey, startDayKey), endDayKey);

  const daysElapsed =
    phase === "BEFORE" ? 0 : Math.min(daysBetween(startDayKey, currentDayKey) + 1, totalDays);
  const daysRemaining = phase === "ENDED" ? 0 : totalDays - daysElapsed;

  return {
    phase,
    startDayKey,
    endDayKey,
    currentDayKey,
    totalDays,
    daysElapsed,
    daysRemaining,
    progress: totalDays === 0 ? 0 : daysElapsed / totalDays,
  };
}

/**
 * The last day that may hold challenge activity right now: today while the challenge
 * is running, the final day once it is over. Used to bound streak and heatmap ranges.
 */
export function effectiveEndDayKey(window: ChallengeWindow, now: Date = new Date()): DayKey {
  return minDayKey(toDayKey(now, window.timezone), challengeEndDayKey(window));
}

/** Human-readable month buckets (September to December) for the monthly breakdown. */
export interface MonthBucket {
  key: string;
  label: string;
  firstDay: DayKey;
  lastDay: DayKey;
}

export function challengeMonths(window: ChallengeWindow): MonthBucket[] {
  const start = challengeStartDayKey(window);
  const end = challengeEndDayKey(window);
  const buckets: MonthBucket[] = [];

  let cursor = `${start.slice(0, 7)}-01`;
  while (cursor <= end) {
    const [yearText, monthText] = cursor.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthLastDay = `${yearText}-${monthText}-${pad(lastDayOfMonth)}`;

    buckets.push({
      key: `${yearText}-${monthText}`,
      label: new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(year, month - 1, 1)),
      ),
      firstDay: maxDayKey(cursor, start),
      lastDay: minDayKey(monthLastDay, end),
    });

    cursor = addDays(monthLastDay, 1);
  }

  return buckets;
}

/** Formats an instant for display in the challenge timezone. */
export function formatInChallengeTz(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(instant);
}
