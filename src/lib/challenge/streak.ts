/**
 * Streak calculation.
 *
 * Streaks are computed from stored historical activity (`DailySnapshot` rows), never
 * from a browser clock. The caller supplies "today" as an explicit day key derived
 * server-side in the challenge timezone, which keeps the function pure and testable.
 *
 * Definitions:
 *   current streak - consecutive challenge days ending at today (or at the final day
 *                    once the challenge is over) on which at least one problem was solved.
 *   longest streak - the longest such run anywhere inside the challenge window.
 *
 * A day with zero solves breaks a streak. Today is the one exception: it is still in
 * progress, so not having solved anything *yet today* does not retroactively end a
 * streak that was alive yesterday.
 */

import { addDays, eachDay, maxDayKey, minDayKey } from "./dates";
import type { ActivityDay, DayKey } from "./types";

export interface StreakBounds {
  /** First day of the challenge. */
  startDayKey: DayKey;
  /** Last day of the challenge. */
  endDayKey: DayKey;
  /** Today in the challenge timezone, computed server-side. */
  todayDayKey: DayKey;
}

export interface StreakResult {
  current: number;
  longest: number;
  /** Number of days in range with at least one solve. */
  activeDays: number;
}

/**
 * Days on which the student solved at least one problem, restricted to the challenge
 * window. Multiple solves on one day collapse to a single active day.
 */
export function activeDaySet(
  activity: readonly ActivityDay[],
  bounds: Pick<StreakBounds, "startDayKey" | "endDayKey">,
): Set<DayKey> {
  const active = new Set<DayKey>();
  for (const entry of activity) {
    if (entry.solved <= 0) continue;
    if (entry.day < bounds.startDayKey || entry.day > bounds.endDayKey) continue;
    active.add(entry.day);
  }
  return active;
}

export function computeStreaks(
  activity: readonly ActivityDay[],
  bounds: StreakBounds,
): StreakResult {
  const active = activeDaySet(activity, bounds);
  const empty: StreakResult = { current: 0, longest: 0, activeDays: 0 };
  if (active.size === 0) return empty;

  const longest = longestRun(active);
  const current = currentRun(active, bounds);

  return { current, longest, activeDays: active.size };
}

function longestRun(active: Set<DayKey>): number {
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let previous: DayKey | null = null;

  for (const day of sorted) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  return longest;
}

function currentRun(active: Set<DayKey>, bounds: StreakBounds): number {
  // Once the challenge is over the streak is measured to the final day, not to today.
  const anchor = minDayKey(bounds.todayDayKey, bounds.endDayKey);
  if (anchor < bounds.startDayKey) return 0;

  let cursor = anchor;

  if (!active.has(cursor)) {
    const anchorIsToday = anchor === bounds.todayDayKey;
    // Today is still in progress, so look back one day before giving up. Any other
    // missing day is a genuine gap and resets the streak to zero.
    if (!anchorIsToday || cursor <= bounds.startDayKey) return 0;
    cursor = addDays(cursor, -1);
    if (!active.has(cursor)) return 0;
  }

  let streak = 0;
  while (cursor >= bounds.startDayKey && active.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * Fills every day in the range, including days with no recorded activity.
 * The heatmap needs a dense series; the database only stores days we synced.
 */
export function densifyActivity(
  activity: readonly ActivityDay[],
  from: DayKey,
  to: DayKey,
): ActivityDay[] {
  const byDay = new Map<DayKey, ActivityDay>();
  for (const entry of activity) {
    byDay.set(entry.day, entry);
  }

  return eachDay(from, to).map((day) => {
    const entry = byDay.get(day);
    return {
      day,
      solved: entry?.solved ?? 0,
      submissions: entry?.submissions ?? 0,
    };
  });
}

/**
 * The most active day across a set of activity rows, used by the challenge overview.
 * Ties resolve to the earlier day so the answer is stable.
 */
export function busiestDay(activity: readonly ActivityDay[]): ActivityDay | null {
  let best: ActivityDay | null = null;
  for (const entry of activity) {
    if (entry.solved <= 0) continue;
    if (best === null || entry.solved > best.solved || (entry.solved === best.solved && entry.day < best.day)) {
      best = entry;
    }
  }
  return best;
}

/** Clamps an arbitrary day range to the challenge window. */
export function clampRange(
  from: DayKey,
  to: DayKey,
  bounds: Pick<StreakBounds, "startDayKey" | "endDayKey">,
): { from: DayKey; to: DayKey } {
  return {
    from: maxDayKey(from, bounds.startDayKey),
    to: minDayKey(to, bounds.endDayKey),
  };
}
