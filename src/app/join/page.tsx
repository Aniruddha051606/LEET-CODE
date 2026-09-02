import type { Metadata } from "next";
import Link from "next/link";

import { JoinForm } from "@/components/join-form";
import { Card } from "@/components/ui/card";
import { getChallengeSettings } from "@/lib/challenge/config";
import { challengeTimeline } from "@/lib/challenge/dates";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join the Challenge",
  description:
    "Register for the college LeetCode challenge with your name, student ID and LeetCode username.",
};

export default async function JoinPage() {
  let windowLabel: string | null = null;
  let phase: "BEFORE" | "ACTIVE" | "ENDED" | null = null;

  try {
    const settings = await getChallengeSettings();
    const timeline = challengeTimeline(settings);
    phase = timeline.phase;
    windowLabel = `${formatDate(settings.startDate, settings.timezone)} — ${formatDate(
      settings.endDate,
      settings.timezone,
    )}`;
  } catch {
    windowLabel = null;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 sm:py-20">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Join the challenge</h1>
        <p className="mt-2 text-sm text-muted">
          Three fields. Everything else is read from your public LeetCode profile and kept up to
          date automatically.
        </p>
        {windowLabel ? (
          <p className="mt-3 text-xs text-subtle">
            {phase === "ENDED"
              ? `This challenge ended on ${windowLabel.split("—")[1]?.trim()}. You can still register to track future runs.`
              : windowLabel}
          </p>
        ) : null}
      </div>

      <Card className="p-6">
        <JoinForm />
      </Card>

      <p className="mt-6 text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/leaderboard" className="text-accent hover:underline">
          Find yourself on the leaderboard
        </Link>
        .
      </p>
    </div>
  );
}
