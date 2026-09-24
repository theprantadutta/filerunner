"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { authApi, projectsApi } from "@/lib/api";
import { useProjectSlots } from "@/lib/spectrum";
import { showToast } from "@/lib/toast";
import { NavRail, MobileTabBar } from "./NavRail";
import { CommandPalette } from "./CommandPalette";
import { UploadTray } from "./UploadTray";
import { NewProjectDialog, PasswordDialog } from "./Dialogs";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, refreshToken, logout } = useAuthStore();
  const signedIn = !!(accessToken || refreshToken);
  const assignSlots = useProjectSlots((s) => s.assign);

  // Project colours are assigned from the full list, so load it on every page
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await projectsApi.list()).data,
    enabled: signedIn,
  });
  useEffect(() => {
    if (projects.data) assignSlots(projects.data);
  }, [projects.data, assignSlots]);

  useEffect(() => {
    if (!signedIn) router.replace("/login");
  }, [signedIn, router]);

  const signOut = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Signing out locally is enough if the server can't be reached
    }
    logout();
    queryClient.clear();
    showToast.success("Signed out");
    router.push("/login");
  };

  if (!signedIn) return null;

  return (
    <div className="min-h-dvh">
      <NavRail onSignOut={signOut} />
      <MobileTabBar />
      <main className="pb-32 lg:pb-12 lg:pl-[76px]">{children}</main>
      <CommandPalette />
      <UploadTray />
      <NewProjectDialog />
      <PasswordDialog />
    </div>
  );
}
