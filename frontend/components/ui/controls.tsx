"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** On/off switch */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-good data-[state=unchecked]:bg-line-strong",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block h-6 w-6 rounded-full bg-white shadow-lift transition-transform duration-200 data-[state=checked]:translate-x-5" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Accessible name when the label is an icon */
  ariaLabel?: string;
  count?: number;
}

/** A row of mutually exclusive options with a sliding highlight */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full bg-sunken p-1",
        size === "sm" ? "h-9" : "h-10",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-all duration-200 [&_svg]:h-4 [&_svg]:w-4",
              active ? "bg-surface text-ink shadow-lift" : "text-ink-3 hover:text-ink"
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn("tabular text-xs", active ? "text-ink-3" : "text-ink-3/70")}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
