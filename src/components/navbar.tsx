"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/challenge", label: "Challenge" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The admin area has its own chrome; the public nav would only be noise there.
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-background/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-foreground text-[11px] font-bold text-background">
            LC
          </span>
          <span className="hidden sm:inline">Campus Challenge</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname.startsWith(link.href)
                  ? "bg-surface-muted font-medium text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/join">Join Challenge</Link>
          </Button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-[var(--border)] bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/join"
              onClick={() => setOpen(false)}
              className="rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground"
            >
              Join Challenge
            </Link>
          </div>
          <div className="mt-3 flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </header>
  );
}
