import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FileRunner - File Management & CDN Platform",
  description: "Self-hostable file management and CDN platform",
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
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
          <Toaster
            position="bottom-right"
            expand={false}
            closeButton
            toastOptions={{
              duration: 4000,
              classNames: {
                toast:
                  "!font-sans !rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-float",
                description: "!text-muted-foreground",
                success: "[&_[data-icon]]:!text-success",
                error: "[&_[data-icon]]:!text-destructive",
                warning: "[&_[data-icon]]:!text-warning",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
