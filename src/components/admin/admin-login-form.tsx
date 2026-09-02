"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Incorrect password.");
      setPassword("");
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Admin password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          disabled={busy}
          invalid={Boolean(error)}
        />
        <FieldError>{error ?? undefined}</FieldError>
      </div>

      <Button type="submit" className="w-full" disabled={busy || password.length === 0}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
