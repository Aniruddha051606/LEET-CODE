import "server-only";

import { prisma } from "@/lib/db";

import {
  DEFAULT_CHALLENGE_END_ISO,
  DEFAULT_CHALLENGE_START_ISO,
  DEFAULT_TIMEZONE,
} from "./dates";
import { DEFAULT_SCORING, isValidScoring } from "./scoring";
import type { ChallengeSettings, ScoringConfig } from "./types";

/**
 * The single source of truth for the challenge window and the scoring table.
 *
 * Everything that computes a score reads from here, so an admin changing the points in
 * the dashboard changes the whole product at once — no code touches literal point values.
 */

const CONFIG_ID = "default";
const CACHE_TTL_MS = 60_000;

const DEFAULTS = {
  challengeName: "College LeetCode 4-Month Challenge",
  startDate: new Date(DEFAULT_CHALLENGE_START_ISO),
  endDate: new Date(DEFAULT_CHALLENGE_END_ISO),
  timezone: DEFAULT_TIMEZONE,
  ...DEFAULT_SCORING,
} satisfies ChallengeSettings;

let cache: { value: ChallengeSettings; expiresAt: number } | null = null;

/** Called after any write so the next read sees fresh configuration immediately. */
export function invalidateChallengeSettings(): void {
  cache = null;
}

/**
 * Reads the configuration, creating the singleton row on first use.
 *
 * Cached briefly: this is read by nearly every request, and the values change roughly
 * never. A stale window for up to a minute after an admin edit is an acceptable trade.
 */
export async function getChallengeSettings(): Promise<ChallengeSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const row = await prisma.challengeConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID, ...DEFAULTS },
  });

  const value: ChallengeSettings = {
    challengeName: row.challengeName,
    startDate: row.startDate,
    endDate: row.endDate,
    timezone: row.timezone,
    easyPoints: row.easyPoints,
    mediumPoints: row.mediumPoints,
    hardPoints: row.hardPoints,
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export interface ChallengeSettingsPatch {
  challengeName?: string;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
  easyPoints?: number;
  mediumPoints?: number;
  hardPoints?: number;
}

export async function updateChallengeSettings(
  patch: ChallengeSettingsPatch,
): Promise<ChallengeSettings> {
  const current = await getChallengeSettings();

  const merged: ChallengeSettings = { ...current, ...patch };

  if (merged.endDate.getTime() <= merged.startDate.getTime()) {
    throw new Error("The challenge end date must be after the start date.");
  }
  const scoring: ScoringConfig = {
    easyPoints: merged.easyPoints,
    mediumPoints: merged.mediumPoints,
    hardPoints: merged.hardPoints,
  };
  if (!isValidScoring(scoring)) {
    throw new Error("Point values must be whole numbers between 0 and 1000.");
  }
  if (!isValidTimezone(merged.timezone)) {
    throw new Error(`"${merged.timezone}" is not a recognised IANA timezone.`);
  }

  await prisma.challengeConfig.upsert({
    where: { id: CONFIG_ID },
    update: merged,
    create: { id: CONFIG_ID, ...merged },
  });

  invalidateChallengeSettings();
  return merged;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Narrow view for code that only needs the point values. */
export function scoringOf(settings: ChallengeSettings): ScoringConfig {
  return {
    easyPoints: settings.easyPoints,
    mediumPoints: settings.mediumPoints,
    hardPoints: settings.hardPoints,
  };
}
