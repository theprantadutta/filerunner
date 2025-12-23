"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { FolderOpen } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { accessToken, refreshToken } = useAuthStore();

  useEffect(() => {
    // Check if user has any auth token (access or refresh)
    if (accessToken || refreshToken) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [accessToken, refreshToken, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="text-center animate-fade-up">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FolderOpen className="h-12 w-12 text-primary animate-pulse" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          FileRunner
        </h1>
        <p className="mt-2 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
