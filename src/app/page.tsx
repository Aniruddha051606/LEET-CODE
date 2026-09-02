import { ArrowRight, BarChart3, Crown, Flame, Users } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { getChallengeSummary, type ChallengeSummary } from "@/lib/services/challenge-stats";
import { formatDate, formatNumber } from "@/lib/utils";

// Reads live challenge figures, so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // The landing page is the front door: if the database is briefly unavailable it
  // should still render and still let people join, just without the live counters.
  let summary: ChallengeSummary | null = null;
  try {
    summary = await getChallengeSummary();
  } catch {
    summary = null;
  }

  return (
    <div>
      <Hero summary={summary} />
      <HowItWorks />
      <ScoringStrip summary={summary} />
    </div>
  );
}

function Hero({ summary }: { summary: ChallengeSummary | null }) {
  const timeline = summary?.timeline;
  const settings = summary?.settings;

  return (
    <section className="hero-wash border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="animate-rise">
          {settings ? (
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-surface px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-easy" />
              {formatDate(settings.startDate, settings.timezone)} —{" "}
              {formatDate(settings.endDate, settings.timezone)}
            </p>
          ) : null}

          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            4 months.
            <br />
            One codebase.
            <br />
            <span className="text-subtle">No excuses.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
            A college-wide LeetCode challenge. Register once with your LeetCode username and we take
            it from there — your solved problems, streaks and points are read from your public
            profile and refreshed automatically. You never type a statistic.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/join">
                Join the Challenge
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/leaderboard">View Leaderboard</Link>
            </Button>
          </div>
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] lg:grid-cols-4">
          <HeroStat
            icon={<Users className="size-3.5" />}
            label="Participants"
            value={summary ? formatNumber(summary.participants) : "—"}
          />
          <HeroStat
            icon={<BarChart3 className="size-3.5" />}
            label="Problems solved"
            value={summary ? formatNumber(summary.totalSolved) : "—"}
            hint="during the challenge"
          />
          <HeroStat
            icon={<Crown className="size-3.5" />}
            label="Current leader"
            value={summary?.leader ? summary.leader.name.split(" ")[0]! : "—"}
            hint={
              summary?.leader
                ? `${formatNumber(summary.leader.solved)} solved`
                : "no solves recorded yet"
            }
            avatar={
              summary?.leader ? (
                <Avatar
                  initials={summary.leader.initials}
                  name={summary.leader.name}
                  size="sm"
                />
              ) : null
            }
            href={summary?.leader ? `/student/${summary.leader.username}` : undefined}
          />
          <HeroStat
            icon={<Flame className="size-3.5" />}
            label={timeline?.phase === "ENDED" ? "Challenge" : "Days remaining"}
            value={
              timeline
                ? timeline.phase === "ENDED"
                  ? "Finished"
                  : formatNumber(timeline.daysRemaining)
                : "—"
            }
            hint={timeline && timeline.phase === "ACTIVE" ? `day ${timeline.daysElapsed} of ${timeline.totalDays}` : undefined}
          />
        </dl>
      </div>
    </section>
  );
}

function HeroStat({
  icon,
  label,
  value,
  hint,
  avatar,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  avatar?: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="h-full bg-background p-5 transition-colors hover:bg-surface">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-subtle">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 flex items-center gap-2">
        {avatar}
        <span className="tabular truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {value}
        </span>
      </dd>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function HowItWorks() {
  const steps = [
    {
      title: "Enter your LeetCode username",
      body: "Name, college ID, LeetCode username. That is the entire form. We check the profile exists before you are registered.",
    },
    {
      title: "We track your progress",
      body: "We store a baseline the moment you join, then refresh your public profile automatically. Only problems you solve during the challenge count.",
    },
    {
      title: "Compete with your college",
      body: "A live leaderboard ranked by problems solved during the challenge, with points for difficulty — easy, medium and hard are not worth the same.",
    },
    {
      title: "Finish stronger than you started",
      body: "Streaks, a contribution heatmap, monthly breakdowns and your rank movement, so four months of work is visible rather than vague.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
      <p className="mt-2 max-w-xl text-muted">
        Four steps, and only the first one needs you.
      </p>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="bg-surface p-6">
            <span className="tabular text-xs font-medium text-subtle">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2 font-medium">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ScoringStrip({ summary }: { summary: ChallengeSummary | null }) {
  const scoring = summary?.settings;

  return (
    <section className="border-t border-[var(--border)] bg-surface-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">How points work</h2>
          <p className="mt-1 text-sm text-muted">
            Ranking is by problems solved during the challenge; points break the ties and reward
            harder problems.
          </p>
        </div>

        <div className="flex gap-3">
          <ScorePill label="Easy" points={scoring?.easyPoints ?? 1} tone="easy" />
          <ScorePill label="Medium" points={scoring?.mediumPoints ?? 3} tone="medium" />
          <ScorePill label="Hard" points={scoring?.hardPoints ?? 5} tone="hard" />
        </div>
      </div>
    </section>
  );
}

function ScorePill({
  label,
  points,
  tone,
}: {
  label: string;
  points: number;
  tone: "easy" | "medium" | "hard";
}) {
  const toneClass = { easy: "text-easy", medium: "text-medium", hard: "text-hard" }[tone];
  return (
    <div className="flex-1 rounded-xl border border-[var(--border)] bg-surface px-5 py-4 text-center lg:flex-none lg:px-8">
      <p className={`text-xs font-medium uppercase tracking-wider ${toneClass}`}>{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{points}</p>
      <p className="text-xs text-subtle">{points === 1 ? "point" : "points"}</p>
    </div>
  );
}
