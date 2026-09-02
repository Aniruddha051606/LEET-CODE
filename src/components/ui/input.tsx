import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-lg border bg-surface px-3 text-sm text-foreground transition-colors",
        "placeholder:text-subtle",
        "focus:outline-none focus-visible:border-accent",
        invalid ? "border-[var(--danger)]" : "border-[var(--border)] hover:border-[var(--border-strong)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...props} />
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-subtle">{children}</p>;
}
