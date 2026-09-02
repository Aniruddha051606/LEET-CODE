"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "RANK", label: "Rank" },
  { value: "SOLVED", label: "Solved" },
  { value: "POINTS", label: "Points" },
  { value: "STREAK", label: "Streak" },
  { value: "NAME", label: "Name" },
] as const;

/**
 * Search and sort controls.
 *
 * State lives in the URL rather than in component state, so the server component above
 * does the filtering against the database. That keeps the page fast with thousands of
 * students and makes any view shareable as a link.
 */
export function LeaderboardControls({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") ?? "";
  const currentSort = searchParams.get("sort") ?? "RANK";
  const [value, setValue] = useState(currentSearch);
  const [syncedSearch, setSyncedSearch] = useState(currentSearch);

  // When the URL changes from elsewhere (back button, a shared link), pull the input
  // back into line. Adjusting state during render is React's documented pattern for
  // this; doing it in an effect would cause an extra render pass.
  if (syncedSearch !== currentSearch) {
    setSyncedSearch(currentSearch);
    setValue(currentSearch);
  }

  // Debounced so typing does not fire a query per keystroke.
  useEffect(() => {
    if (value === currentSearch) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("search", value.trim());
      else params.delete("search");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, currentSearch, pathname, router, searchParams]);

  function setSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "RANK") params.delete("sort");
    else params.set("sort", sort);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search students"
          aria-label="Search students by name or LeetCode username"
          className="pl-9 pr-9"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="tabular hidden text-xs text-subtle sm:inline">{total} students</span>
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-[var(--border)] bg-surface p-0.5">
          {SORTS.map((sort) => (
            <button
              key={sort.value}
              type="button"
              onClick={() => setSort(sort.value)}
              aria-pressed={currentSort === sort.value}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                currentSort === sort.value
                  ? "bg-surface-muted font-medium text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {sort.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Highlights the row belonging to whoever registered in this browser.
 *
 * There are no student accounts, so "you" is remembered locally at registration time.
 * The highlight is purely presentational and reads nothing the page did not already show.
 */
export function HighlightCurrentStudent() {
  useEffect(() => {
    let username: string | null = null;
    try {
      username = window.localStorage.getItem("lc-username");
    } catch {
      return;
    }
    if (!username) return;

    const selector = `[data-username="${CSS.escape(username.toLowerCase())}"]`;
    const targets = document.querySelectorAll<HTMLElement>(selector);

    targets.forEach((element) => {
      element.classList.add("ring-2", "ring-[var(--accent)]", "ring-inset", "bg-accent-soft/40");
      if (!element.querySelector("[data-you-badge]")) {
        const badge = document.createElement("span");
        badge.dataset.youBadge = "true";
        badge.textContent = "You";
        badge.className =
          "ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground align-middle";
        element.querySelector("a span span")?.append(badge);
      }
    });
  }, []);

  return null;
}
