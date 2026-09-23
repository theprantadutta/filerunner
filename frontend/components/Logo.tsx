import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Hide the wordmark and show only the mark */
  markOnly?: boolean;
}

export function Logo({ className, markOnly = false }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-7 w-7 shrink-0"
      >
        <rect width="24" height="24" rx="6" className="fill-primary" />
        {/* Stacked sheets, the top one moving right */}
        <path
          d="M7 8.5h7M7 12h10M7 15.5h5.5"
          className="stroke-primary-foreground"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
      {!markOnly && (
        <span className="text-[15px] font-semibold tracking-[-0.015em]">
          FileRunner
        </span>
      )}
    </span>
  );
}
