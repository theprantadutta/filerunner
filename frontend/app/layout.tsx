import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FileRunner",
    template: "%s – FileRunner",
  },
  description: "Self-hosted file storage and CDN",
  applicationName: "FileRunner",
  appleWebApp: {
    title: "FileRunner",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0C10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>{children}</Providers>
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-2xl !border !border-line !bg-surface !text-ink !shadow-pop !font-sans !gap-3 !py-3.5",
                title: "!font-semibold",
                description: "!text-ink-3",
                success: "[&_[data-icon]]:!text-good",
                error: "[&_[data-icon]]:!text-bad",
                warning: "[&_[data-icon]]:!text-warn",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
