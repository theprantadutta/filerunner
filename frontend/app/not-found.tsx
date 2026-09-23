import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <Logo />
      <p className="mt-10 text-sm font-medium tabular text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The link may be broken, or the page may have moved.
      </p>
      <Link href="/dashboard" className="mt-6">
        <Button>Go to projects</Button>
      </Link>
    </div>
  );
}
