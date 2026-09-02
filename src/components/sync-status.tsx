"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn, formatRelative } from "@/lib/utils";

/**
 * Sync freshness, plus a manual refresh.
 *
 * The refresh endpoint is rate limited server-side, so this button cannot be used to
 * push traffic at LeetCode. If a refresh fails the student is told plainly that we will
 * retry — their existing numbers are never replaced with a guess.
 */
export function SyncStatus({
  username,
  status,
  lastSyncedAt,
  className,
}: {
  username: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  lastSyncedAt: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const busy = refreshing || isPending;

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(username)}/sync`, {
        method: "POST",
      });

      if (response.status === 429) {
        setMessage("You have refreshed recently. Try again in a few minutes.");
      } else if (!response.ok) {
        setMessage("We couldn't refresh your LeetCode data. We'll try again.");
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setMessage("We couldn't refresh your LeetCode data. We'll try again.");
    } finally {
      setRefreshing(false);
    }
  }

  const indicator =
    status === "FAILED" ? (
      <span className="flex items-center gap-1.5 text-xs text-hard">
        <AlertTriangle className="size-3.5" />
        Last refresh failed. We&rsquo;ll try again automatically.
      </span>
    ) : status === "PENDING" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin" />
        Fetching your LeetCode stats...
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <CheckCircle2 className="size-3.5 text-easy" />
        Updated {formatRelative(lastSyncedAt)}
      </span>
    );

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="space-y-1">
        {indicator}
        {message ? <p className="text-xs text-hard">{message}</p> : null}
      </div>
      <Button variant="secondary" size="sm" onClick={refresh} disabled={busy}>
        <RefreshCw className={cn("size-4", busy && "animate-spin")} />
        {busy ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}
