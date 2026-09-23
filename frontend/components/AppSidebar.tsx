"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { projectsApi, type User } from "@/lib/api";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Folder,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

const RECENT_LIMIT = 6;

interface AppSidebarProps {
  user: User | null;
  onLogout: () => void;
  onChangePassword: () => void;
}

export function AppSidebar({ user, onLogout, onChangePassword }: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // Shares the cache entry with the projects page, so this costs no extra request
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await projectsApi.list()).data,
  });

  const recent = [...(projects ?? [])]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, RECENT_LIMIT);

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link
          href="/dashboard"
          className="rounded-md focus-visible:ring-offset-card"
          aria-label="FileRunner home"
        >
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        <NavLink
          href="/dashboard"
          active={pathname === "/dashboard"}
          icon={<LayoutGrid />}
        >
          All projects
        </NavLink>

        <div className="mt-6 px-2 pb-1.5 text-xs font-medium text-muted-foreground">
          Recent projects
        </div>
        <div className="space-y-0.5">
          {isLoading &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex h-8 items-center gap-2.5 px-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 flex-1" />
              </div>
            ))}
          {!isLoading && recent.length === 0 && (
            <p className="px-2 py-1 text-[13px] text-muted-foreground">
              Projects you create appear here.
            </p>
          )}
          {recent.map((project) => (
            <NavLink
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              active={pathname === `/dashboard/projects/${project.id}`}
              icon={<Folder />}
            >
              {project.name}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:ring-offset-card data-[state=open]:bg-accent">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {user?.email}
              </span>
              <span className="block text-xs capitalize text-muted-foreground">
                {user?.role ?? "user"}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4 text-muted-foreground" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onChangePassword}>
              <KeyRound className="mr-2" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onLogout}>
              <LogOut className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors focus-visible:ring-offset-card [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        active
          ? "bg-accent text-foreground [&_svg]:text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
