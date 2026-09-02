import { NextResponse } from "next/server";

import { handle, noStore, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminExtras, getSyncHealth } from "@/lib/services/admin";
import { getChallengeOverview } from "@/lib/services/challenge-stats";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — everything the admin dashboard renders. */
export async function GET(): Promise<NextResponse> {
  return handle("admin.stats", async () => {
    await requireAdmin();

    const [overview, health, extras] = await Promise.all([
      getChallengeOverview(),
      getSyncHealth(),
      getAdminExtras(),
    ]);

    return noStore(
      ok({
        totals: {
          students: overview.participants,
          activeStudents: overview.activeParticipants,
          solvedToday: extras.solvedToday,
          demoStudents: extras.demoStudents,
          totalSolved: overview.totalSolved,
          totalPoints: overview.totalPoints,
          averagePerStudent: overview.averagePerStudent,
        },
        leader: overview.leader,
        longestStreak: overview.longestStreak,
        difficultyTotals: overview.difficultyTotals,
        daily: overview.daily,
        weekly: overview.weekly,
        monthly: overview.monthly,
        sync: health,
      }),
    );
  });
}
