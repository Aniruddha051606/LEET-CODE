import { z } from "zod";

import { LEETCODE_USERNAME_PATTERN } from "@/lib/leetcode/types";

/**
 * Every piece of input that crosses the network boundary is parsed here first.
 *
 * Note what is absent: there is no schema anywhere that accepts a solved count, a
 * difficulty tally, a streak or a point total. Those are derived server-side and are
 * not expressible as input, which is what makes the leaderboard tamper-proof.
 */

export const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(80, "That name is too long.")
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}.'\- ]*$/u, "Please use letters, spaces, hyphens and apostrophes only."),
  studentId: z
    .string()
    .trim()
    .min(2, "Please enter your college student ID.")
    .max(40, "That student ID is too long.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, "Student IDs may contain letters, digits, hyphens, slashes and underscores."),
  leetcodeUsername: z
    .string()
    .trim()
    .min(1, "Please enter your LeetCode username.")
    .max(39, "LeetCode usernames are at most 39 characters.")
    .regex(LEETCODE_USERNAME_PATTERN, "That is not a valid LeetCode username."),
});

export type RegistrationPayload = z.infer<typeof registrationSchema>;

export const usernameParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(LEETCODE_USERNAME_PATTERN, "Invalid LeetCode username.");

export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(["RANK", "SOLVED", "POINTS", "STREAK", "NAME"]).default("RANK"),
});

export const adminStudentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(80).optional(),
  onlyFailed: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, "Enter the admin password.").max(200),
});

export const challengeConfigSchema = z
  .object({
    challengeName: z.string().trim().min(3).max(120).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    easyPoints: z.coerce.number().int().min(0).max(1000).optional(),
    mediumPoints: z.coerce.number().int().min(0).max(1000).optional(),
    hardPoints: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const globalSyncSchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  concurrency: z.coerce.number().int().min(1).max(8).optional(),
});

export const studentIdParamSchema = z.string().trim().min(1).max(64);

/** Flattens a Zod error into `{ field: message }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
