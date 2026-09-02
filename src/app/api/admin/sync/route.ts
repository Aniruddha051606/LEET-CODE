import { NextResponse } from "next/server";

import { fail, handle, noStore, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { syncAllStudents } from "@/lib/services/sync";
import { globalSyncSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/admin/sync — operator-triggered global refresh. */
export async function POST(request: Request): Promise<NextResponse> {
  return handle("admin.sync", async () => {
    await requireAdmin();

    const url = new URL(request.url);
    const parsed = globalSyncSchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      concurrency: url.searchParams.get("concurrency") ?? undefined,
    });

    if (!parsed.success) return fail(400, "Invalid sync parameters.", { code: "VALIDATION_FAILED" });

    const summary = await syncAllStudents({
      trigger: "ADMIN",
      limit: parsed.data.limit,
      concurrency: parsed.data.concurrency,
    });

    return noStore(
      ok({
        syncRunId: summary.syncRunId,
        totalStudents: summary.totalStudents,
        succeeded: summary.succeeded,
        failed: summary.failed,
        durationMs: summary.durationMs,
      }),
    );
  });
}
