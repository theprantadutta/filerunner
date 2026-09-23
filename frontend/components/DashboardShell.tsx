"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { AppSidebar } from "@/components/AppSidebar";
import { Logo } from "@/components/Logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, refreshToken, user, logout } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    // Check if user has any token (access or refresh)
    if (!accessToken && !refreshToken) {
      router.push("/login");
    }
  }, [accessToken, refreshToken, router]);

  // Close the mobile drawer after navigating (adjust state during render, not in an effect)
  const [navPathname, setNavPathname] = useState(pathname);
  if (navPathname !== pathname) {
    setNavPathname(pathname);
    setMobileNavOpen(false);
  }

  const handleLogout = async () => {
    try {
      // Call logout endpoint to revoke refresh token
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      // Continue with local logout even if API call fails
    }
    logout();
    showToast.success("Signed out");
    router.push("/login");
  };

  // Don't render if no auth
  if (!accessToken && !refreshToken) {
    return null;
  }

  const sidebar = (
    <AppSidebar
      user={user}
      onLogout={handleLogout}
      onChangePassword={() => {
        setMobileNavOpen(false);
        setPasswordOpen(true);
      }}
    />
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Show forced password change modal if required */}
      {/* Separate keys: without them React reuses one dialog and its content visibly
          switches from the forced to the voluntary variant while closing */}
      {user?.must_change_password ? (
        <ChangePasswordModal key="forced" isForced />
      ) : (
        <ChangePasswordModal key="voluntary" open={passwordOpen} onOpenChange={setPasswordOpen} />
      )}

      <aside className="sticky top-0 hidden h-screen border-r bg-card lg:block">
        {sidebar}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6 lg:hidden">
          <Link href="/dashboard" aria-label="FileRunner home" className="rounded-md">
            <Logo />
          </Link>
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
