import { Logo } from "./Logo";
import { FileMosaic } from "./FileMosaic";

/** Sign-in and sign-up: the form on a clean surface beside a living wall of files */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="animate-rise font-display text-[40px] font-bold leading-[1.02] tracking-[-0.04em] text-ink">{title}</h1>
          <p className="mt-3 animate-rise text-base leading-relaxed text-ink-2 [animation-delay:60ms]">{description}</p>
          <div className="mt-9 animate-rise [animation-delay:120ms]">{children}</div>
          <div className="mt-8 text-sm text-ink-2">{footer}</div>
        </div>
        <p className="text-xs text-ink-3">Self-hosted file storage and delivery.</p>
      </main>

      <aside aria-hidden="true" className="relative hidden overflow-hidden bg-rail lg:block">
        <div className="absolute inset-0 -rotate-6 scale-125">
          <FileMosaic columns={7} rows={10} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-rail via-rail/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md font-display text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-white">
            Every file, sorted by project and ready to serve.
          </p>
        </div>
      </aside>
    </div>
  );
}
