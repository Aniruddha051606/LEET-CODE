"use client";

import { Download, Loader2, LogOut, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import type { ChallengeSettings } from "@/lib/challenge/types";

/** Toolbar actions: trigger a sync, export the leaderboard, sign out. */
export function AdminToolbar() {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "logout" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function triggerSync() {
    setBusy("sync");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/sync", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { succeeded?: number; failed?: number; totalStudents?: number; error?: string }
        | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "The sync could not be started.");
      } else {
        setMessage(
          `Synced ${payload?.succeeded ?? 0} of ${payload?.totalStudents ?? 0} students` +
            (payload?.failed ? `, ${payload.failed} failed.` : "."),
        );
        router.refresh();
      }
    } catch {
      setMessage("The sync could not be started.");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("logout");
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {message ? <span className="mr-auto text-xs text-muted">{message}</span> : null}

      <Button variant="secondary" size="sm" onClick={triggerSync} disabled={busy !== null}>
        {busy === "sync" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Refresh data
      </Button>

      <Button variant="secondary" size="sm" asChild>
        <a href="/api/admin/export">
          <Download className="size-4" />
          Export CSV
        </a>
      </Button>

      <Button variant="ghost" size="sm" onClick={signOut} disabled={busy !== null}>
        <LogOut className="size-4" />
        Sign out
      </Button>
    </div>
  );
}

/** Per-student actions: disable, re-enable, resync, delete. */
export function StudentActions({
  studentId,
  name,
  isActive,
}: {
  studentId: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "disable" | "enable" | "resync") {
    setBusy(true);
    try {
      await fetch(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    // Deleting removes every snapshot and solved problem for this student, so it asks first.
    const confirmed = window.confirm(
      `Remove ${name} from the challenge? This deletes their history and cannot be undone.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await fetch(`/api/admin/students/${studentId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => act("resync")} disabled={busy}>
        Resync
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => act(isActive ? "disable" : "enable")}
        disabled={busy}
      >
        {isActive ? "Disable" : "Enable"}
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-hard">
        Remove
      </Button>
    </div>
  );
}

/**
 * Scoring and window configuration.
 *
 * Editing these values changes how every score in the product is computed, because the
 * leaderboard reads the point values from this same row rather than from constants.
 */
export function ChallengeConfigForm({ settings }: { settings: ChallengeSettings }) {
  const router = useRouter();
  const [values, setValues] = useState({
    challengeName: settings.challengeName,
    easyPoints: String(settings.easyPoints),
    mediumPoints: String(settings.mediumPoints),
    hardPoints: String(settings.hardPoints),
    timezone: settings.timezone,
  });
  const [status, setStatus] = useState<{ kind: "idle" | "saved" | "error"; message?: string }>({
    kind: "idle",
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({ kind: "idle" });

    try {
      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeName: values.challengeName,
          timezone: values.timezone,
          easyPoints: Number(values.easyPoints),
          mediumPoints: Number(values.mediumPoints),
          hardPoints: Number(values.hardPoints),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setStatus({ kind: "error", message: payload?.error ?? "Could not save the configuration." });
      } else {
        setStatus({ kind: "saved", message: "Saved. New points apply from the next sync." });
        router.refresh();
      }
    } catch {
      setStatus({ kind: "error", message: "Could not save the configuration." });
    } finally {
      setBusy(false);
    }
  }

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus({ kind: "idle" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="challengeName">Challenge name</Label>
        <Input
          id="challengeName"
          value={values.challengeName}
          onChange={(event) => update("challengeName", event.target.value)}
          disabled={busy}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["easyPoints", "Easy"],
            ["mediumPoints", "Medium"],
            ["hardPoints", "Hard"],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field}>{label}</Label>
            <Input
              id={field}
              type="number"
              min={0}
              max={1000}
              inputMode="numeric"
              value={values[field]}
              onChange={(event) => update(field, event.target.value)}
              disabled={busy}
              className="tabular"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Challenge timezone</Label>
        <Input
          id="timezone"
          value={values.timezone}
          onChange={(event) => update("timezone", event.target.value)}
          disabled={busy}
          placeholder="Asia/Kolkata"
        />
        <p className="text-xs text-subtle">
          Daily boundaries and streaks are computed in this timezone.
        </p>
      </div>

      {status.kind === "error" ? <FieldError>{status.message}</FieldError> : null}
      {status.kind === "saved" ? <p className="text-sm text-easy">{status.message}</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save configuration
      </Button>
    </form>
  );
}

/** Search box for the admin roster, backed by the URL like the public leaderboard. */
export function AdminStudentSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (value.trim()) params.set("search", value.trim());
    const query = params.toString();
    router.replace(query ? `/admin?${query}` : "/admin", { scroll: false });
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by name, student ID or username"
        aria-label="Search students"
        className="h-9 sm:w-72"
      />
      <Button type="submit" variant="secondary" size="sm">
        Search
      </Button>
    </form>
  );
}
