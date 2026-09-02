import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional class names, with later Tailwind utilities winning conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Compact form for hero figures: 12,400 becomes 12.4k. */
export function formatCompact(value: number): string {
  if (Math.abs(value) < 10_000) return numberFormatter.format(value);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: Date | string, timeZone = "Asia/Kolkata"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatDateTime(value: Date | string, timeZone = "Asia/Kolkata"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/** "3 minutes ago" style label, for sync timestamps. */
export function formatRelative(value: Date | string | null): string {
  if (value === null) return "never";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 45) return "just now";
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86_400],
    ["week", 604_800],
    ["month", 2_629_800],
    ["year", 31_557_600],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0]!;
  for (const unit of units) {
    if (seconds >= unit[1]) chosen = unit;
  }
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Percentage clamped to 0-100, for progress bars. */
export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}
