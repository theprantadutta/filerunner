"use client";

import * as React from "react";
import { RotateCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, apiError } from "@/lib/utils";

/** Stacked colour tiles behind an icon: the empty-state motif */
function TileStack({ icon: Icon, danger }: { icon: LucideIcon; danger?: boolean }) {
  return (
    <div className="relative mb-6 h-20 w-24" aria-hidden="true">
      <div
        className={cn(
          "absolute left-0 top-5 h-14 w-14 -rotate-12 rounded-2xl",
          danger ? "bg-bad/20" : "bg-c3/25"
        )}
      />
      <div
        className={cn(
          "absolute right-0 top-4 h-14 w-14 rotate-12 rounded-2xl",
          danger ? "bg-bad/30" : "bg-c2/30"
        )}
      />
      <div
        className={cn(
          "absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-2xl shadow-lift",
          danger ? "bg-bad text-white" : "bg-ink text-canvas"
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
    </div>
  );
}

/** Centered message with an optional action, for empty and "nothing matches" states */
export function EmptyPanel({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center animate-rise", className)}>
      <TileStack icon={icon} />
      <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-2">{description}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

/** Failed request with the server's message and a retry */
export function ErrorPanel({
  icon,
  title,
  error,
  fallback = "The server didn't respond. Check that the backend is running, then try again.",
  onRetry,
  retrying,
  className,
}: {
  icon: LucideIcon;
  title: string;
  error?: unknown;
  fallback?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-16 text-center animate-rise", className)}>
      <TileStack icon={icon} danger />
      <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-2">{apiError(error, fallback)}</p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry} loading={retrying}>
          {!retrying && <RotateCw />}
          Try again
        </Button>
      )}
    </div>
  );
}
