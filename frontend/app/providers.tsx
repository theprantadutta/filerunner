"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initConfig } from "@/lib/config";
import { setLogoutHandler } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { showToast } from "@/lib/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [configReady, setConfigReady] = useState(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Initialize runtime config on mount - wait for it to complete
  useEffect(() => {
    initConfig().then(() => setConfigReady(true));
  }, []);

  // Set up the logout handler for API interceptor
  useEffect(() => {
    setLogoutHandler(() => {
      logout();
      showToast.error("Your session has expired. Please log in again.");
      router.push("/login");
    });
  }, [logout, router]);

  // Don't render children until config is ready to prevent API calls with wrong URL
  if (!configReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
