import { NextResponse } from "next/server";

import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { toDayKey } from "@/lib/challenge/dates";
import { getChallengeSettings } from "@/lib/challenge/config";
import { exportLeaderboardCsv } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/export — leaderboard as CSV, including college student IDs. */
export async function GET(): Promise<NextResponse> {
  return handle("admin.export", async () => {
    await requireAdmin();

    const settings = await getChallengeSettings();
    const csv = await exportLeaderboardCsv();
    const stamp = toDayKey(new Date(), settings.timezone);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leaderboard-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
