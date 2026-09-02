"use client";

import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";

/**
 * Registration form.
 *
 * Three fields, none of them a statistic. Validation is enforced on the server; what
 * happens here is only about giving fast, specific feedback.
 */

interface FieldErrors {
  name?: string;
  studentId?: string;
  leetcodeUsername?: string;
}

export function JoinForm() {
  const router = useRouter();

  const [values, setValues] = useState({ name: "", studentId: "", leetcodeUsername: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          studentId: values.studentId.trim(),
          leetcodeUsername: values.leetcodeUsername.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { username?: string; error?: string; fields?: Record<string, string> }
        | null;

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields as FieldErrors);
        setFormError(payload?.fields ? null : (payload?.error ?? "Something went wrong. Please try again."));
        setStatus("idle");
        return;
      }

      const username = payload?.username ?? values.leetcodeUsername.trim();

      // There are no student accounts. Remembering the username locally is what lets the
      // leaderboard highlight "your" row on this device.
      try {
        window.localStorage.setItem("lc-username", username.toLowerCase());
      } catch {
        // Private browsing or storage disabled: the dashboard still works, just no highlight.
      }

      setStatus("done");
      router.push(`/student/${username}`);
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
    }
  }

  const busy = status === "submitting" || status === "done";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="Ananya Sharma"
          autoComplete="name"
          required
          disabled={busy}
          invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        <span id="name-error">
          <FieldError>{errors.name}</FieldError>
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="studentId">College student ID</Label>
        <Input
          id="studentId"
          name="studentId"
          value={values.studentId}
          onChange={(event) => update("studentId", event.target.value)}
          placeholder="21CS1043"
          autoComplete="off"
          required
          disabled={busy}
          invalid={Boolean(errors.studentId)}
          aria-describedby={errors.studentId ? "studentId-error" : undefined}
        />
        <span id="studentId-error">
          <FieldError>{errors.studentId}</FieldError>
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="leetcodeUsername">LeetCode username</Label>
        <Input
          id="leetcodeUsername"
          name="leetcodeUsername"
          value={values.leetcodeUsername}
          onChange={(event) => update("leetcodeUsername", event.target.value)}
          placeholder="your-leetcode-handle"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={busy}
          invalid={Boolean(errors.leetcodeUsername)}
          aria-describedby={
            errors.leetcodeUsername ? "leetcodeUsername-error" : "leetcodeUsername-hint"
          }
        />
        <span id="leetcodeUsername-error">
          <FieldError>{errors.leetcodeUsername}</FieldError>
        </span>
        {!errors.leetcodeUsername ? (
          <FieldHint>
            <span id="leetcodeUsername-hint">
              The handle in your profile URL, for example leetcode.com/u/<b>your-handle</b>. Your
              profile must be public.
            </span>
          </FieldHint>
        ) : null}
      </div>

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[var(--danger)] bg-hard-soft px-3 py-2 text-sm text-hard"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Fetching your LeetCode stats...
          </>
        ) : (
          <>
            Join the Challenge
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-subtle">
        We only read data that is already public on your LeetCode profile.
      </p>
    </form>
  );
}
