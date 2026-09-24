import { cn } from "@/lib/utils";

/** Three tiles cascading forward: files on the move. Mirrors app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-8 w-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="#15161B" />
      <rect x="5" y="14" width="13" height="13" rx="3.5" fill="#1BAF7A" />
      <rect x="9.5" y="9.5" width="13" height="13" rx="3.5" fill="#EB6834" stroke="#15161B" strokeWidth="1.5" />
      <rect x="14" y="5" width="13" height="13" rx="3.5" fill="#2F5BFF" stroke="#15161B" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className, tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-[19px] font-bold tracking-[-0.03em]",
          tone === "light" ? "text-white" : "text-ink"
        )}
      >
        FileRunner
      </span>
    </span>
  );
}
