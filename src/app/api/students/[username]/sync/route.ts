import { NextResponse } from "next/server";

import { enforceRateLimit, fail, handle, noStore, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { syncStudentAndRerank } from "@/lib/services/sync";
import { usernameParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/students/:username/sync — refresh one student on demand.
 *
 * Tightly rate limited: this reaches out to LeetCode, so it must not become a way for
 * anyone to drive traffic at them through us. Routine refreshing is the cron's job.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  return handle("students.sync", async () => {
    const limited = enforceRateLimit(request, "student-sync", RATE_LIMITS.manualSync);
    if (limited) return limited;

    const { username } = await context.params;
    const parsed = usernameParamSchema.safeParse(username);
    if (!parsed.success) return fail(400, "Invalid username.", { code: "VALIDATION_FAILED" });

    const student = await prisma.student.findUnique({
      where: { usernameKey: parsed.data.toLowerCase() },
      select: { id: true, isActive: true },
    });

    if (!student || !student.isActive) {
      return fail(404, "That student has not joined the challenge.", { code: "NOT_FOUND" });
    }

    const result = await syncStudentAndRerank(student.id);

    if (result.status === "FAILED") {
      return noStore(
        fail(502, "We couldn't refresh your LeetCode data. We'll try again automatically.", {
          code: "SYNC_FAILED",
        }),
      );
    }

    return noStore(
      ok({
        status: result.status,
        challengeSolved: result.challengeSolved ?? 0,
        challengePoints: result.challengePoints ?? 0,
        newProblems: result.newProblems ?? 0,
      }),
    );
  });
}
