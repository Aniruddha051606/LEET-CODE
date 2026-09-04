import { NextResponse } from "next/server";

import { enforceRateLimit, fail, handle, noStore, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { registerStudent } from "@/lib/services/registration";
import { registrationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
// Registration verifies the profile with LeetCode and then runs the first sync for that
// student. Without this the Vercel default cuts it short and the student is left on zero.
export const maxDuration = 60;

/**
 * POST /api/students — join the challenge.
 *
 * Accepts a name, college student ID and LeetCode username. Nothing else: no statistic
 * a student could supply is read from this request. Registration is rate limited
 * because it triggers an outbound LeetCode request.
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handle("students.register", async () => {
    const limited = enforceRateLimit(request, "register", RATE_LIMITS.registration);
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "Expected a JSON body.", { code: "INVALID_JSON" });
    }

    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (!(key in fields)) fields[key] = issue.message;
      }
      return fail(400, "Some fields need attention.", { code: "VALIDATION_FAILED", fields });
    }

    const result = await registerStudent(parsed.data);

    if (!result.ok) {
      const status = result.code === "PROFILE_NOT_FOUND" ? 404 : result.code === "PROVIDER_UNAVAILABLE" ? 503 : 409;
      return fail(status, result.message, {
        code: result.code,
        ...(result.field ? { fields: { [result.field]: result.message } } : {}),
      });
    }

    return noStore(
      ok({ username: result.username, dashboardUrl: `/student/${result.username}` }, { status: 201 }),
    );
  });
}
