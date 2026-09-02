"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states";

/**
 * Application-level error boundary.
 *
 * Students see a plain explanation and a retry; the underlying error goes to the
 * console for operators. `error.digest` is the server-side correlation id Next.js
 * generates — the message itself never reaches the browser in production.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
      <ErrorState
        title="Something went wrong"
        description="We hit an unexpected problem loading this page. Your challenge data is safe."
        onRetry={reset}
      />
      {error.digest ? (
        <p className="mt-4 text-center text-xs text-subtle">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
