"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { BootScreen } from "@/components/brand/BootScreen";

export default function Home() {
  const router = useRouter();
  const { accessToken, refreshToken } = useAuthStore();

  useEffect(() => {
    router.replace(accessToken || refreshToken ? "/dashboard" : "/login");
  }, [accessToken, refreshToken, router]);

  return <BootScreen />;
}
