import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty, loading and error states.
 *
 * Every page that can be empty, slow or broken uses one of these, so a student never
 * meets a blank screen and never meets a stack trace.
 */

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-subtle">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-hard-soft text-hard">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({
  message = "Loading...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin text-accent" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
