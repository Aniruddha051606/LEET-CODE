import { NextResponse } from "next/server";

import { fail, handle, noStore, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { getChallengeSettings, updateChallengeSettings } from "@/lib/challenge/config";
import { recomputeRanks } from "@/lib/services/sync";
import { challengeConfigSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/config — current challenge window and scoring table. */
export async function GET(): Promise<NextResponse> {
  return handle("admin.config.get", async () => {
    await requireAdmin();
    return noStore(ok(await getChallengeSettings()));
  });
}

/**
 * PUT /api/admin/config — change the challenge window or the point values.
 *
 * Changing scoring changes how every future sync scores. Existing stored point totals
 * are recomputed on each student's next sync; ranks are refreshed immediately so the
 * ordering never contradicts the configuration on screen.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  return handle("admin.config.put", async () => {
    await requireAdmin();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "Expected a JSON body.", { code: "INVALID_JSON" });
    }

    const parsed = challengeConfigSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fields[issue.path.join(".") || "form"] = issue.message;
      }
      return fail(400, "Some fields need attention.", { code: "VALIDATION_FAILED", fields });
    }

    try {
      const updated = await updateChallengeSettings(parsed.data);
      await recomputeRanks();
      return noStore(ok(updated));
    } catch (error) {
      // These are the deliberate, human-readable guards from updateChallengeSettings.
      const message = error instanceof Error ? error.message : "Could not update configuration.";
      return fail(400, message, { code: "INVALID_CONFIG" });
    }
  });
}
