import { NextResponse } from "next/server";

import { fail, handle, isCronAuthorised, noStore, ok } from "@/lib/api";
import { env } from "@/lib/env";
import { syncAllStudents } from "@/lib/services/sync";
import { globalSyncSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
// A batch of syncs is bounded by the LeetCode rate limiter, so give it room.
export const maxDuration = 300;

/**
 * Global synchronisation, run hourly by cron (see `vercel.json`).
 *
 * Each invocation processes a bounded batch of the stalest students so a single run
 * stays well inside serverless execution limits; successive runs work through the
 * whole college. With the default batch of 200 and an hourly schedule this comfortably
 * covers a 2,000-student cohort well within a day, and a smaller college continuously.
 *
 * Authorised by `CRON_SECRET`. Vercel Cron sends it as a bearer token automatically.
 */
async function runSync(request: Request): Promise<NextResponse> {
  if (!isCronAuthorised(request, env.cronSecret)) {
    return fail(401, "Not authorised.", { code: "UNAUTHORIZED" });
  }

  const url = new URL(request.url);
  const parsed = globalSyncSchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    concurrency: url.searchParams.get("concurrency") ?? undefined,
  });

  if (!parsed.success) {
    return fail(400, "Invalid sync parameters.", { code: "VALIDATION_FAILED" });
  }

  const summary = await syncAllStudents({
    trigger: "CRON",
    limit: parsed.data.limit,
    concurrency: parsed.data.concurrency,
  });

  return noStore(
    ok({
      syncRunId: summary.syncRunId,
      totalStudents: summary.totalStudents,
      succeeded: summary.succeeded,
      failed: summary.failed,
      skipped: summary.skipped,
      durationMs: summary.durationMs,
    }),
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  return handle("sync.cron", () => runSync(request));
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle("sync.cron", () => runSync(request));
}
