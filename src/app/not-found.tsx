import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="tabular text-sm font-medium text-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">We couldn&rsquo;t find that page</h1>
      <p className="mt-2 text-sm text-muted">
        The student may not have joined the challenge, or the link may be out of date.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/leaderboard">View the leaderboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/join">Join the challenge</Link>
        </Button>
      </div>
    </div>
  );
}
