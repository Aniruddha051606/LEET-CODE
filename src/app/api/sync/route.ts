import { NextResponse } from "next/server";

import { fail, handle, isCronAuthorised, noStore, ok } from "@/lib/api";
import { env } from "@/lib/env";
import { syncAllStudents } from "@/lib/services/sync";
import { globalSyncSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
// 60s is the Vercel Hobby ceiling and is valid on every plan. Raise to 300 on Pro if
// you also raise the batch size in vercel.json.
export const maxDuration = 60;

/**
 * Global synchronisation, run hourly by cron (see `vercel.json`).
 *
 * Each invocation processes a bounded batch of the stalest students so a single run
 * stays well inside serverless execution limits; successive runs work through the
 * whole college.
 *
 * `vercel.json` requests `?limit=60`, which at the default 4 requests/second finishes
 * comfortably inside the 60s function ceiling. Hourly, that refreshes ~1,440 students a
 * day. For a larger cohort raise the limit and `maxDuration` together (Pro allows 300s),
 * or run `npm run sync -- --all` from a machine with no time limit.
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
