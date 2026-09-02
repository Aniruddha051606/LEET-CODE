"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "lc-theme";

/**
 * Theme switcher.
 *
 * The stored preference is an external store (localStorage plus the OS colour-scheme
 * media query), so it is read with `useSyncExternalStore` rather than copied into state
 * inside an effect. That gives a correct server snapshot — "system" — and therefore no
 * hydration mismatch and no cascading render on mount.
 *
 * The class itself is applied before first paint by `themeInitScript` in the document
 * head, so there is never a flash of the wrong theme.
 */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private browsing or storage disabled: fall back to following the OS.
    return "system";
  }
}

function serverTheme(): Theme {
  return "system";
}

function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  // While following the system, an OS change must repaint the page as well as re-render.
  const onMediaChange = () => {
    applyTheme(readStoredTheme());
    onStoreChange();
  };

  media.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function chooseTheme(theme: Theme): void {
  try {
    if (theme === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Preference cannot be persisted; still apply it for this page view.
  }
  applyTheme(theme);
  emit();
}

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, serverTheme);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-surface p-0.5",
        className,
      )}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => chooseTheme(option.value)}
            aria-pressed={active}
            title={option.label}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors",
              active ? "bg-surface-muted text-foreground" : "text-subtle hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Runs before paint to set the theme class. Kept as a string so it can be injected into
 * the document head, which is what prevents a flash of the wrong theme on first load.
 */
export const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
