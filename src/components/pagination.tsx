import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Server-rendered pagination.
 *
 * Links rather than buttons, so pages are shareable, crawlable and work without
 * JavaScript. Only rendered when there is more than one page.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);

  return (
    <nav
      className={cn("flex items-center justify-between gap-2", className)}
      aria-label="Leaderboard pagination"
    >
      <PageLink href={buildHref(page - 1)} disabled={page <= 1} label="Previous">
        <ChevronLeft className="size-4" />
        <span className="hidden sm:inline">Previous</span>
      </PageLink>

      <ol className="flex items-center gap-1">
        {pages.map((value, index) =>
          value === null ? (
            <li key={`gap-${index}`} className="px-1 text-sm text-subtle">
              &hellip;
            </li>
          ) : (
            <li key={value}>
              <Link
                href={buildHref(value)}
                aria-current={value === page ? "page" : undefined}
                className={cn(
                  "tabular inline-flex size-9 items-center justify-center rounded-lg text-sm transition-colors",
                  value === page
                    ? "bg-foreground font-medium text-background"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {value}
              </Link>
            </li>
          ),
        )}
      </ol>

      <PageLink href={buildHref(page + 1)} disabled={page >= totalPages} label="Next">
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-sm transition-colors";

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "cursor-not-allowed text-subtle opacity-50")}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={cn(className, "text-muted hover:text-foreground hover:bg-surface-muted")}>
      {children}
    </Link>
  );
}

/** Page numbers around the current one, with gaps collapsed to an ellipsis. */
function pageWindow(page: number, totalPages: number): Array<number | null> {
  const shown = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => shown.add(value));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((v) => shown.add(v));

  const valid = [...shown].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  const result: Array<number | null> = [];
  let previous: number | null = null;
  for (const value of valid) {
    if (previous !== null && value - previous > 1) result.push(null);
    result.push(value);
    previous = value;
  }
  return result;
}
