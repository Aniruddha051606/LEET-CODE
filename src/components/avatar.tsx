import { cn } from "@/lib/utils";

/**
 * Initials avatar.
 *
 * The hue is derived from the name, so a student's colour is stable across pages
 * without storing anything. No external avatar service is contacted and no image is
 * loaded unless LeetCode already published one on the public profile.
 */
function hueFor(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}

export function Avatar({
  initials,
  name,
  size = "md",
  className,
}: {
  initials: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hue = hueFor(name);
  const sizes = {
    sm: "size-7 text-[11px]",
    md: "size-9 text-xs",
    lg: "size-14 text-lg",
  };

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: `oklch(0.92 0.05 ${hue})`,
        color: `oklch(0.42 0.13 ${hue})`,
      }}
    >
      {initials}
    </span>
  );
}
