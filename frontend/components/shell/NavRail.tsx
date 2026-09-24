"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Boxes,
  KeyRound,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { Tip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

export const NAV: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, match: (p) => p === "/dashboard" },
  { href: "/dashboard/projects", label: "Projects", icon: Boxes, match: (p) => p.startsWith("/dashboard/projects") },
  { href: "/dashboard/account", label: "Account", icon: UserRound, match: (p) => p.startsWith("/dashboard/account") },
];

function RailButton({
  label,
  active,
  children,
  ...props
}: { label: string; active?: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip label={label} side="right">
      <button
        type="button"
        aria-label={label}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors [&_svg]:h-5 [&_svg]:w-5",
          active ? "bg-nav-ink/10 text-nav-ink" : "text-nav-muted hover:bg-nav-ink/5 hover:text-nav-ink"
        )}
        {...props}
      >
        {children}
      </button>
    </Tip>
  );
}

/** Desktop navigation: a slim rail of icons, light or dark with the theme */
export function NavRail({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { setCommandOpen, setNewProjectOpen, setPasswordOpen } = useUi();
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-line bg-nav py-4 lg:flex">
      <Link href="/dashboard" aria-label="FileRunner overview" className="mb-6 rounded-xl">
        <LogoMark className="h-10 w-10" />
      </Link>

      <nav aria-label="Main" className="flex flex-col items-center gap-1.5">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Tip key={item.href} label={item.label} side="right">
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors [&_svg]:h-5 [&_svg]:w-5",
                  active ? "bg-nav-ink/10 text-nav-ink" : "text-nav-muted hover:bg-nav-ink/5 hover:text-nav-ink"
                )}
              >
                {active && <span className="absolute -left-[16px] h-6 w-1 rounded-r-full bg-brand" />}
                <Icon />
              </Link>
            </Tip>
          );
        })}
      </nav>

      <div className="my-4 h-px w-8 bg-nav-ink/10" />

      <div className="flex flex-col items-center gap-1.5">
        <RailButton label="Search (Ctrl K)" onClick={() => setCommandOpen(true)}>
          <Search />
        </RailButton>
        <Tip label="New project" side="right">
          <button
            type="button"
            aria-label="New project"
            onClick={() => setNewProjectOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </Tip>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <RailButton
          label={resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
        </RailButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-c1 to-c7 font-display text-sm font-bold text-white ring-2 ring-nav-ink/10 transition hover:ring-nav-ink/25"
          >
            {initial}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64">
            <DropdownMenuLabel className="truncate text-sm font-semibold text-ink">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/account">
                <UserRound />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound />
              Change password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={onSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

/** Phone navigation: a bottom bar with a raised "new project" button in the middle */
export function MobileTabBar() {
  const pathname = usePathname();
  const { setCommandOpen, setNewProjectOpen } = useUi();
  const [overview, projects, account] = NAV;

  const tab = (item: (typeof NAV)[number]) => {
    const active = item.match(pathname);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors",
          active ? "text-nav-ink" : "text-nav-muted"
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center rounded-[26px] border border-line bg-nav/95 px-2 shadow-pop backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      {tab(overview)}
      {tab(projects)}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label="New project"
          onClick={() => setNewProjectOpen(true)}
          className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-pop ring-4 ring-canvas transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold text-nav-muted"
      >
        <Search className="h-[22px] w-[22px]" />
        Search
      </button>
      {tab(account)}
    </nav>
  );
}
