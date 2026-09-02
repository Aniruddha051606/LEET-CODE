import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-[var(--border)] bg-surface-muted text-muted",
        accent: "border-transparent bg-accent-soft text-accent",
        easy: "border-transparent bg-easy-soft text-easy",
        medium: "border-transparent bg-medium-soft text-medium",
        hard: "border-transparent bg-hard-soft text-hard",
        success: "border-transparent bg-easy-soft text-easy",
        danger: "border-transparent bg-hard-soft text-hard",
        outline: "border-[var(--border-strong)] text-muted",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Maps a difficulty onto its badge variant, so the mapping lives in exactly one place. */
export function difficultyVariant(
  difficulty: "EASY" | "MEDIUM" | "HARD" | null,
): "easy" | "medium" | "hard" | "neutral" {
  switch (difficulty) {
    case "EASY":
      return "easy";
    case "MEDIUM":
      return "medium";
    case "HARD":
      return "hard";
    default:
      return "neutral";
  }
}

export function difficultyLabel(difficulty: "EASY" | "MEDIUM" | "HARD" | null): string {
  switch (difficulty) {
    case "EASY":
      return "Easy";
    case "MEDIUM":
      return "Medium";
    case "HARD":
      return "Hard";
    default:
      return "Unrated";
  }
}
