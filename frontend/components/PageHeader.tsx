import { cn } from "@/lib/utils";

/** Page wrapper with consistent gutters and max width */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10", className)}>{children}</div>;
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 animate-rise">
        {kicker && <div className="mb-2 text-sm font-semibold text-ink-3">{kicker}</div>}
        <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[44px]">
          {title}
        </h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** A titled card region */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl border border-line bg-surface p-5 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
