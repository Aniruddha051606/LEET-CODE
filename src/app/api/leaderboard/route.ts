import { NextResponse } from "next/server";

import { enforceRateLimit, fail, handle, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getLeaderboard } from "@/lib/services/leaderboard";
import { leaderboardQuerySchema } from "@/lib/validation";

/**
 * GET /api/leaderboard
 *
 * Served entirely from the database. Opening the leaderboard triggers zero LeetCode
 * requests regardless of how many students are registered.
 */
export async function GET(request: Request): Promise<NextResponse> {
  return handle("leaderboard.get", async () => {
    const limited = enforceRateLimit(request, "leaderboard", RATE_LIMITS.publicRead);
    if (limited) return limited;

    const url = new URL(request.url);
    const parsed = leaderboardQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
    });

    if (!parsed.success) {
      return fail(400, "Invalid leaderboard query.", { code: "VALIDATION_FAILED" });
    }

    const page = await getLeaderboard(parsed.data);
    const response = ok(page);
    // Short shared cache: the underlying numbers only change when a sync runs.
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return response;
  });
}
