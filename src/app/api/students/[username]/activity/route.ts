import { NextResponse } from "next/server";

import { enforceRateLimit, fail, handle, noStore, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getStudentDashboard } from "@/lib/services/student";
import { usernameParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/students/:username/activity — day-by-day challenge activity for the heatmap. */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  return handle("students.activity", async () => {
    const limited = enforceRateLimit(request, "student-activity", RATE_LIMITS.publicRead);
    if (limited) return limited;

    const { username } = await context.params;
    const parsed = usernameParamSchema.safeParse(username);
    if (!parsed.success) return fail(400, "Invalid username.", { code: "VALIDATION_FAILED" });

    const dashboard = await getStudentDashboard(parsed.data);
    if (!dashboard) {
      return fail(404, "That student has not joined the challenge.", { code: "NOT_FOUND" });
    }

    return noStore(
      ok({
        username: dashboard.username,
        timezone: dashboard.settings.timezone,
        start: dashboard.settings.startDate,
        end: dashboard.settings.endDate,
        days: dashboard.activity,
        streaks: dashboard.streaks,
      }),
    );
  });
}
