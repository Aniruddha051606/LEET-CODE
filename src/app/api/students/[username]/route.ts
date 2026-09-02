import { NextResponse } from "next/server";

import { enforceRateLimit, fail, handle, noStore, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getStudentDashboard } from "@/lib/services/student";
import { usernameParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/students/:username — a student's public challenge statistics. */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  return handle("students.get", async () => {
    const limited = enforceRateLimit(request, "student-read", RATE_LIMITS.publicRead);
    if (limited) return limited;

    const { username } = await context.params;
    const parsed = usernameParamSchema.safeParse(username);
    if (!parsed.success) return fail(400, "Invalid username.", { code: "VALIDATION_FAILED" });

    const dashboard = await getStudentDashboard(parsed.data);
    if (!dashboard) {
      return fail(404, "That student has not joined the challenge.", { code: "NOT_FOUND" });
    }

    // The public payload deliberately omits database ids and the college student ID.
    return noStore(
      ok({
        name: dashboard.name,
        username: dashboard.username,
        profileUrl: dashboard.profileUrl,
        avatarUrl: dashboard.avatarUrl,
        joinedAt: dashboard.joinedAt,
        rank: dashboard.rank,
        movement: dashboard.movement,
        movementDelta: dashboard.movementDelta,
        weeklyRank: dashboard.weeklyRank,
        monthlyRank: dashboard.monthlyRank,
        percentile: dashboard.percentile,
        totalParticipants: dashboard.totalParticipants,
        challenge: dashboard.challenge,
        lifetime: dashboard.lifetime,
        streaks: dashboard.streaks,
        monthly: dashboard.monthly,
        recent: dashboard.recent,
        sync: {
          status: dashboard.sync.status,
          lastSyncedAt: dashboard.sync.lastSyncedAt,
        },
      }),
    );
  });
}
