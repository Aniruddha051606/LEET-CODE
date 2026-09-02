import type { ActivityDay } from "@/lib/challenge/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * GitHub-style contribution heatmap for the challenge window.
 *
 * Rendered entirely on the server as a CSS grid — no charting library, no client
 * JavaScript. Intensity is the number of problems *solved* that day (not submissions),
 * which is what the challenge actually measures.
 *
 * Days are challenge-timezone calendar days, already converted upstream, so no date
 * arithmetic happens in the browser.
 */

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;

function intensityOf(solved: number): 0 | 1 | 2 | 3 | 4 {
  if (solved <= 0) return 0;
  if (solved <= 2) return 1;
  if (solved <= 4) return 2;
  if (solved <= 7) return 3;
  return 4;
}

function weekdayOf(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}

export function ActivityHeatmap({
  days,
  timezone,
  className,
}: {
  days: readonly ActivityDay[];
  timezone: string;
  className?: string;
}) {
  if (days.length === 0) {
    return (
      <p className={cn("text-sm text-muted", className)}>No challenge activity yet.</p>
    );
  }

  // Pad the first week so each column is a real Sunday-to-Saturday week.
  const leadingBlanks = weekdayOf(days[0]!.day);
  const cells: Array<ActivityDay | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];

  const weeks: Array<Array<ActivityDay | null>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  const monthLabels = buildMonthLabels(weeks);
  const totalSolved = days.reduce((total, day) => total + day.solved, 0);
  const activeDays = days.filter((day) => day.solved > 0).length;

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          <div className="flex gap-1 pl-8 text-[10px] text-subtle">
            {monthLabels.map((label, index) => (
              <span
                key={`${label.text}-${index}`}
                className="shrink-0"
                style={{ width: `calc(${label.span} * (0.75rem + 0.25rem) - 0.25rem)` }}
              >
                {label.text}
              </span>
            ))}
          </div>

          <div className="mt-1 flex gap-1">
            <div className="flex w-7 shrink-0 flex-col gap-1 pt-0.5 text-[10px] leading-3 text-subtle">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index} className="h-3">
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const day = week[dayIndex] ?? null;
                    if (!day) {
                      return <div key={dayIndex} className="size-3 rounded-[3px]" />;
                    }
                    const level = intensityOf(day.solved);
                    return (
                      <div
                        key={dayIndex}
                        className="size-3 rounded-[3px] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04]"
                        style={{ backgroundColor: `var(--heat-${level})` }}
                        title={`${day.solved} ${day.solved === 1 ? "problem" : "problems"} on ${formatDate(
                          new Date(`${day.day}T00:00:00Z`),
                          "UTC",
                        )}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-subtle">
        <span>
          {totalSolved} {totalSolved === 1 ? "problem" : "problems"} across {activeDays} active{" "}
          {activeDays === 1 ? "day" : "days"} ({timezone})
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="size-3 rounded-[3px] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04]"
              style={{ backgroundColor: `var(--heat-${level})` }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

/** One label per month, spanning the weeks that month covers. */
function buildMonthLabels(weeks: Array<Array<ActivityDay | null>>): Array<{ text: string; span: number }> {
  const labels: Array<{ text: string; span: number }> = [];

  for (const week of weeks) {
    const firstReal = week.find((day): day is ActivityDay => day !== null);
    const month = firstReal
      ? new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
          new Date(`${firstReal.day}T00:00:00Z`),
        )
      : "";

    const last = labels[labels.length - 1];
    if (last && last.text === month) {
      last.span += 1;
    } else {
      labels.push({ text: month, span: 1 });
    }
  }

  // Collapse a leading sliver so the first month label is not clipped.
  return labels.map((label, index) => (index === 0 && label.span < 2 ? { ...label, text: "" } : label));
}
