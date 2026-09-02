import { CalendarDays, Clock } from "lucide-react";

import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/ui/badge";
import type { ChallengeTimeline } from "@/lib/challenge/dates";
import type { ChallengeSettings } from "@/lib/challenge/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";

/**
 * Challenge window, phase and elapsed progress. Shared by the challenge overview and
 * the student dashboard so both always describe the same window in the same words.
 */
export function ChallengeHeader({
  settings,
  timeline,
  className,
}: {
  settings: ChallengeSettings;
  timeline: ChallengeTimeline;
  className?: string;
}) {
  const phaseLabel = {
    BEFORE: "Starts soon",
    ACTIVE: "In progress",
    ENDED: "Finished",
  }[timeline.phase];

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-surface p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{settings.challengeName}</h2>
            <Badge variant={timeline.phase === "ACTIVE" ? "accent" : "neutral"}>{phaseLabel}</Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays className="size-3.5" />
            {formatDate(settings.startDate, settings.timezone)} —{" "}
            {formatDate(settings.endDate, settings.timezone)}
            <span className="text-subtle">({settings.timezone})</span>
          </p>
        </div>

        <div className="flex gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Day</p>
            <p className="tabular text-xl font-semibold">
              {formatNumber(timeline.daysElapsed)}
              <span className="text-sm font-normal text-subtle"> / {timeline.totalDays}</span>
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wider text-subtle">
              <Clock className="size-3" />
              Remaining
            </p>
            <p className="tabular text-xl font-semibold">{formatNumber(timeline.daysRemaining)}</p>
          </div>
        </div>
      </div>

      <ProgressBar
        value={timeline.daysElapsed}
        total={timeline.totalDays}
        className="mt-5"
        label="Challenge progress"
      />
    </div>
  );
}
