"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initConfig } from "@/lib/config";
import { setLogoutHandler } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { connectUploadsToQueryClient } from "@/lib/uploads";
import { showToast } from "@/lib/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BootScreen } from "@/components/brand/BootScreen";

const SESSION_KEYS = ["accessToken", "refreshToken", "user"];

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const syncFromStorage = useAuthStore((state) => state.syncFromStorage);
  const [configReady, setConfigReady] = useState(false);

  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
    });
    connectUploadsToQueryClient(client);
    return client;
  });

  // Initialize runtime config on mount - wait for it to complete
  useEffect(() => {
    initConfig().then(() => setConfigReady(true));
  }, []);

  // Set up the logout handler for API interceptor
  useEffect(() => {
    setLogoutHandler(() => {
      logout();
      showToast.error("Your session ended. Sign in again to continue.");
      router.push("/login");
    });
  }, [logout, router]);

  // Keep tabs in step: signing in, refreshing, or signing out in one tab applies to all
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || SESSION_KEYS.includes(event.key)) syncFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncFromStorage]);

  // The API address comes from the server at runtime; show the brand until it arrives
  if (!configReady) {
    return <BootScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
