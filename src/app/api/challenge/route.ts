import { NextResponse } from "next/server";

import { enforceRateLimit, handle, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getChallengeOverview } from "@/lib/services/challenge-stats";

/** GET /api/challenge — college-wide challenge statistics. */
export async function GET(request: Request): Promise<NextResponse> {
  return handle("challenge.get", async () => {
    const limited = enforceRateLimit(request, "challenge", RATE_LIMITS.publicRead);
    if (limited) return limited;

    const overview = await getChallengeOverview();
    const response = ok({
      challenge: {
        name: overview.settings.challengeName,
        startDate: overview.settings.startDate,
        endDate: overview.settings.endDate,
        timezone: overview.settings.timezone,
        scoring: {
          easy: overview.settings.easyPoints,
          medium: overview.settings.mediumPoints,
          hard: overview.settings.hardPoints,
        },
      },
      timeline: overview.timeline,
      participants: overview.participants,
      activeParticipants: overview.activeParticipants,
      solvedToday: overview.solvedToday,
      totalSolved: overview.totalSolved,
      totalPoints: overview.totalPoints,
      averagePerStudent: overview.averagePerStudent,
      difficultyTotals: overview.difficultyTotals,
      mostActiveDay: overview.mostActiveDay,
      longestStreak: overview.longestStreak,
      leader: overview.leader,
      daily: overview.daily,
      weekly: overview.weekly,
      monthly: overview.monthly,
    });

    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response;
  });
}
