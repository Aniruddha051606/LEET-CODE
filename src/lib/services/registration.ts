import "server-only";

import { getChallengeSettings } from "@/lib/challenge/config";
import { challengePhase } from "@/lib/challenge/dates";
import { prisma } from "@/lib/db";
import { getLeetCodeProvider, isLeetCodeProviderError } from "@/lib/leetcode";
import { profileUrlFor } from "@/lib/leetcode/types";

import { syncStudentAndRerank } from "./sync";

/**
 * Registration.
 *
 * A student supplies only their name, college ID and LeetCode username. Everything else
 * — difficulty counts, streaks, points, rank — is fetched and derived. There is no code
 * path anywhere in this application that lets a student type in a statistic.
 */

export interface RegistrationInput {
  name: string;
  studentId: string;
  leetcodeUsername: string;
}

export type RegistrationErrorCode =
  | "DUPLICATE_STUDENT_ID"
  | "DUPLICATE_USERNAME"
  | "PROFILE_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE";

export type RegistrationResult =
  | { ok: true; username: string }
  | { ok: false; code: RegistrationErrorCode; message: string; field?: keyof RegistrationInput };

export async function registerStudent(input: RegistrationInput): Promise<RegistrationResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const collegeId = input.studentId.trim();
  const requestedUsername = input.leetcodeUsername.trim();
  const usernameKey = requestedUsername.toLowerCase();

  // Cheap checks first, so we do not spend a LeetCode request on an obvious duplicate.
  const existing = await prisma.student.findFirst({
    where: { OR: [{ studentId: collegeId }, { usernameKey }] },
    select: { studentId: true, usernameKey: true },
  });

  if (existing) {
    return existing.studentId === collegeId
      ? {
          ok: false,
          code: "DUPLICATE_STUDENT_ID",
          message: "That student ID is already registered for the challenge.",
          field: "studentId",
        }
      : {
          ok: false,
          code: "DUPLICATE_USERNAME",
          message: "That LeetCode username has already joined the challenge.",
          field: "leetcodeUsername",
        };
  }

  // Verify the profile exists and capture the baseline in the same call.
  const provider = getLeetCodeProvider();
  let profile;
  try {
    profile = await provider.getProfile(requestedUsername);
  } catch (error) {
    if (isLeetCodeProviderError(error) && error.code === "USER_NOT_FOUND") {
      return {
        ok: false,
        code: "PROFILE_NOT_FOUND",
        message: "We couldn't find that LeetCode profile. Check the username and try again.",
        field: "leetcodeUsername",
      };
    }
    return {
      ok: false,
      code: "PROVIDER_UNAVAILABLE",
      message: "We couldn't reach LeetCode to verify that profile. Please try again in a moment.",
    };
  }

  const settings = await getChallengeSettings();
  const now = new Date();
  const phase = challengePhase(settings, now);

  // Registering while the challenge is already running fixes the baseline immediately.
  // Registering early leaves it unlocked so that it keeps re-basing until the start,
  // which is what stops August practice from counting towards a September score.
  const lockBaseline = phase !== "BEFORE";

  try {
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          name,
          studentId: collegeId,
          leetcodeUsername: profile.username,
          usernameKey: profile.username.toLowerCase(),
          joinedAt: now,
          baselineTotalSolved: profile.totalSolved,
          baselineEasySolved: profile.easySolved,
          baselineMediumSolved: profile.mediumSolved,
          baselineHardSolved: profile.hardSolved,
          baselineCapturedAt: now,
          baselineLockedAt: lockBaseline ? now : null,
          lastFetchedAt: profile.fetchedAt,
          syncStatus: "PENDING",
        },
        select: { id: true, leetcodeUsername: true },
      });

      await tx.leetCodeProfile.create({
        data: {
          studentId: created.id,
          profileUrl: profile.profileUrl || profileUrlFor(profile.username),
          realName: profile.realName,
          avatarUrl: profile.avatarUrl,
          totalSolved: profile.totalSolved,
          easySolved: profile.easySolved,
          mediumSolved: profile.mediumSolved,
          hardSolved: profile.hardSolved,
          totalSubmissions: profile.totalSubmissions,
          ranking: profile.ranking,
          reputation: profile.reputation,
          lastFetchedAt: profile.fetchedAt,
        },
      });

      return created;
    });

    // Populate the first snapshot and activity feed. A failure here is not fatal: the
    // student exists with a valid baseline and the next scheduled sync will fill it in.
    try {
      await syncStudentAndRerank(student.id);
    } catch {
      // Intentionally ignored; sync status on the student row records the failure.
    }

    return { ok: true, username: student.leetcodeUsername };
  } catch (error) {
    // Two people registering the same identity at the same instant lose the race here
    // rather than at the pre-check, so the unique constraint is the real guarantee.
    if (isUniqueViolation(error, "studentId")) {
      return {
        ok: false,
        code: "DUPLICATE_STUDENT_ID",
        message: "That student ID is already registered for the challenge.",
        field: "studentId",
      };
    }
    if (isUniqueViolation(error, "usernameKey") || isUniqueViolation(error, "leetcodeUsername")) {
      return {
        ok: false,
        code: "DUPLICATE_USERNAME",
        message: "That LeetCode username has already joined the challenge.",
        field: "leetcodeUsername",
      };
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown, field: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: string; meta?: { target?: unknown } };
  if (candidate.code !== "P2002") return false;
  const target = candidate.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}
