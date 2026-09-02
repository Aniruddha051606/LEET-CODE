import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal `asChild` implementation.
 *
 * shadcn/ui normally leans on `@radix-ui/react-slot` for this. We need exactly one
 * behaviour from it — merge props onto a single child element so a `<Button asChild>`
 * can render an `<a>` — so this avoids pulling in a dependency for eight lines of work.
 */
interface SlotProps {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}

export function Slot({ children, className, ...props }: SlotProps) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;

  const childProps = child.props as { className?: string };

  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    ...props,
    className: cn(className, childProps.className),
  });
}
