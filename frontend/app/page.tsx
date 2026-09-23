"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <Logo />
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
