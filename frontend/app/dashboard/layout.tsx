"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { LogOut, FolderOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { accessToken, refreshToken, user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Check if user has any token (access or refresh)
    if (!accessToken && !refreshToken) {
      router.push("/login");
    }
  }, [accessToken, refreshToken, router]);

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
    showToast.success("Logged out successfully");
    router.push("/login");
  };

  // Don't render if no auth
  if (!accessToken && !refreshToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Show forced password change modal if required */}
      {user?.must_change_password && <ChangePasswordModal isForced={true} />}

      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                FileRunner
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-9 w-9"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-up">
        {children}
      </main>
    </div>
  );
}
