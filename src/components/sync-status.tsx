"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn, formatRelative } from "@/lib/utils";

/**
 * How stale a student's figures may be before simply opening the dashboard refreshes
 * them. The scheduled sync is a batch job — on a free hosting plan it may only run a few
 * times a day — so without this a student who solves a problem and immediately checks
 * their page sees nothing and concludes the site is broken.
 *
 * The refresh endpoint is rate limited server-side, so this cannot become a way to drive
 * traffic at LeetCode however often the page is opened.
 */
const STALE_AFTER_MS = 10 * 60 * 1000;

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
  const autoRefreshed = useRef(false);

  async function refresh(automatic = false) {
    setRefreshing(true);
    if (!automatic) setMessage(null);
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(username)}/sync`, {
        method: "POST",
      });

      if (response.status === 429) {
        // Expected when several people share an address, and meaningless noise during an
        // automatic refresh the student never asked for.
        if (!automatic) setMessage("You have refreshed recently. Try again in a few minutes.");
      } else if (!response.ok) {
        if (!automatic) setMessage("We couldn't refresh your LeetCode data. We'll try again.");
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      if (!automatic) setMessage("We couldn't refresh your LeetCode data. We'll try again.");
    } finally {
      setRefreshing(false);
    }
  }

  // Refresh on open when the stored figures have gone stale, so a student who has just
  // solved something sees it without hunting for a button. Runs at most once per mount.
  useEffect(() => {
    if (autoRefreshed.current) return;

    const age = lastSyncedAt === null ? Infinity : Date.now() - new Date(lastSyncedAt).getTime();
    if (status === "SUCCESS" && age < STALE_AFTER_MS) return;

    autoRefreshed.current = true;

    // Started on a timer rather than inline: kicking the request off synchronously in the
    // effect body would also set state there, which cascades an extra render.
    const timer = setTimeout(() => void refresh(true), 0);
    return () => clearTimeout(timer);
    // Deliberately mount-only: this is a freshness check on open, not a poller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Button variant="secondary" size="sm" onClick={() => refresh(false)} disabled={busy}>
        <RefreshCw className={cn("size-4", busy && "animate-spin")} />
        {busy ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}
