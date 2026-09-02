"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

/**
 * Time-series charts for the challenge overview and the admin dashboard.
 *
 * Shared axis and tooltip styling so every chart in the product reads the same way.
 * All series arrive fully computed from the server.
 */

const axisTick = { fill: "var(--foreground-subtle)", fontSize: 11 };

function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

interface TooltipEntry {
  value?: number;
  name?: string;
  color?: string;
}

function SeriesTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">
        {labelFormatter && label ? labelFormatter(label) : label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="tabular mt-0.5 text-muted">
          <span
            className="mr-1.5 inline-block size-2 rounded-full align-middle"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-medium text-foreground">{entry.value ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

export interface DailyDatum {
  day: string;
  solved: number;
  activeStudents: number;
}

export function DailySolvedChart({
  data,
  className,
}: {
  data: readonly DailyDatum[];
  className?: string;
}) {
  if (data.length === 0) {
    return <EmptyChart className={className} />;
  }

  return (
    <div className={cn("h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="solvedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            minTickGap={28}
          />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={axisTick} width={42} />
          <Tooltip content={<SeriesTooltip labelFormatter={shortDay} />} />
          <Area
            type="monotone"
            dataKey="solved"
            name="Problems solved"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#solvedFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ParticipationChart({
  data,
  className,
}: {
  data: readonly DailyDatum[];
  className?: string;
}) {
  if (data.length === 0) return <EmptyChart className={className} />;

  return (
    <div className={cn("h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            minTickGap={28}
          />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={axisTick} width={42} />
          <Tooltip content={<SeriesTooltip labelFormatter={shortDay} />} />
          <Line
            type="monotone"
            dataKey="activeStudents"
            name="Students who solved"
            stroke="var(--easy)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface WeeklyDatum {
  label: string;
  startDay: string;
  solved: number;
}

export function WeeklySolvedChart({
  data,
  className,
}: {
  data: readonly WeeklyDatum[];
  className?: string;
}) {
  if (data.length === 0) return <EmptyChart className={className} />;

  return (
    <div className={cn("h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={axisTick} width={42} />
          <Tooltip cursor={{ fill: "var(--surface-muted)" }} content={<SeriesTooltip />} />
          <Bar
            dataKey="solved"
            name="Problems solved"
            fill="var(--accent)"
            radius={[5, 5, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-64 items-center justify-center text-sm text-muted", className)}>
      No challenge activity yet.
    </div>
  );
}
