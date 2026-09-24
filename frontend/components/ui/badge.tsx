import * as React from "react";
import { Globe2, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small rounded label. Pass --tone via style for spectrum colours. */
export function Chip({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function VisibilityChip({ isPublic, className }: { isPublic: boolean; className?: string }) {
  return isPublic ? (
    <Chip className={cn("bg-good/10 text-good", className)}>
      <Globe2 />
      Public
    </Chip>
  ) : (
    <Chip className={cn("bg-sunken text-ink-2", className)}>
      <LockKeyhole />
      Private
    </Chip>
  );
}
