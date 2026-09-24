import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 py-6 sm:px-10">
      <Logo />
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-8 h-28 w-40" aria-hidden="true">
          <div className="absolute left-2 top-8 h-20 w-20 -rotate-12 rounded-3xl bg-c3/30" />
          <div className="absolute right-2 top-6 h-20 w-20 rotate-12 rounded-3xl bg-c2/40" />
          <div className="absolute left-1/2 top-0 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-3xl bg-ink font-display text-3xl font-bold text-canvas">
            404
          </div>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Nothing lives here</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-2">The link may be broken, or the page may have moved.</p>
        <Link href="/dashboard" className={buttonVariants({ size: "lg", className: "mt-8" })}>
          <ArrowLeft />
          Back to FileRunner
        </Link>
      </main>
    </div>
  );
}
