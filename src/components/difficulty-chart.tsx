"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

/**
 * Difficulty distribution.
 *
 * Uses the same three colours as the badges and the progress bars. Values come from the
 * server already computed; the chart never derives a statistic of its own.
 */

interface DifficultyData {
  easy: number;
  medium: number;
  hard: number;
}

const COLORS = {
  Easy: "var(--easy)",
  Medium: "var(--medium)",
  Hard: "var(--hard)",
} as const;

function toRows(data: DifficultyData) {
  return [
    { name: "Easy" as const, value: data.easy },
    { name: "Medium" as const, value: data.medium },
    { name: "Hard" as const, value: data.hard },
  ];
}

function ChartTooltip({
  active,
  payload,
  suffix = "solved",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { name?: string } }>;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const label = entry?.payload?.name ?? entry?.name ?? "";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-xs shadow-sm">
      <span className="font-medium text-foreground">{label}</span>
      <span className="tabular ml-2 text-muted">
        {entry?.value ?? 0} {suffix}
      </span>
    </div>
  );
}

export function DifficultyDonut({
  data,
  className,
}: {
  data: DifficultyData;
  className?: string;
}) {
  const rows = toRows(data);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (total === 0) {
    return (
      <div className={cn("flex h-52 items-center justify-center text-sm text-muted", className)}>
        No challenge activity yet.
      </div>
    );
  }

  return (
    <div className={cn("relative h-52", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
            // Charts are read, not watched. Disabling the mount animation keeps the
            // marks deterministic (they render identically on first paint and after
            // hydration) and matches the restrained-motion brief.
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.name} fill={COLORS[row.name]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold">{total}</span>
        <span className="text-xs text-subtle">solved</span>
      </div>
    </div>
  );
}

export function DifficultyBars({
  data,
  className,
}: {
  data: DifficultyData;
  className?: string;
}) {
  const rows = toRows(data);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (total === 0) {
    return (
      <div className={cn("flex h-52 items-center justify-center text-sm text-muted", className)}>
        No challenge activity yet.
      </div>
    );
  }

  return (
    <div className={cn("h-52", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }}
            width={40}
          />
          <Tooltip cursor={{ fill: "var(--surface-muted)" }} content={<ChartTooltip />} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            {rows.map((row) => (
              <Cell key={row.name} fill={COLORS[row.name]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legend shared by both chart shapes. */
export function DifficultyLegend({ data }: { data: DifficultyData }) {
  const rows = toRows(data);
  return (
    <ul className="flex flex-wrap items-center justify-center gap-4 text-xs">
      {rows.map((row) => (
        <li key={row.name} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[row.name] }} />
          <span className="text-muted">{row.name}</span>
          <span className="tabular font-medium text-foreground">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}
