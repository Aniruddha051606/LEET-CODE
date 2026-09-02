import { NextResponse } from "next/server";

import { enforceRateLimit, fail, handle, noStore, ok } from "@/lib/api";
import { login } from "@/lib/auth/admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { adminLoginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** POST /api/admin/login */
export async function POST(request: Request): Promise<NextResponse> {
  return handle("admin.login", async () => {
    const limited = enforceRateLimit(request, "admin-login", RATE_LIMITS.adminLogin);
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "Expected a JSON body.", { code: "INVALID_JSON" });
    }

    const parsed = adminLoginSchema.safeParse(body);
    if (!parsed.success) return fail(400, "Enter the admin password.", { code: "VALIDATION_FAILED" });

    const result = await login(parsed.data.password);

    if (!result.ok) {
      if (result.reason === "NOT_CONFIGURED") {
        return fail(
          503,
          "Admin access is not configured on this deployment. Set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET.",
          { code: "NOT_CONFIGURED" },
        );
      }
      // Deliberately identical for a wrong password and any other failure.
      return fail(401, "Incorrect password.", { code: "INVALID_CREDENTIALS" });
    }

    return noStore(ok({ ok: true }));
  });
}
