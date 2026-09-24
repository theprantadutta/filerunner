import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  // A plain string here would stop the root template reaching child pages
  title: {
    default: "Overview – FileRunner",
    template: "%s – FileRunner",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
