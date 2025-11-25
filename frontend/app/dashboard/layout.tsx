"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { LogOut, FolderOpen } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, user, logout } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Show forced password change modal if required */}
      {user?.must_change_password && <ChangePasswordModal isForced={true} />}

      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">FileRunner</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
