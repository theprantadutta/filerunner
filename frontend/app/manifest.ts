import type { MetadataRoute } from "next";

// Relative URLs resolve against the manifest's own URL, so this works under NEXT_PUBLIC_BASE_PATH too
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FileRunner",
    short_name: "FileRunner",
    description: "Self-hostable file management and CDN platform",
    start_url: "./dashboard",
    scope: "./",
    display: "standalone",
    background_color: "#F5F6F8",
    theme_color: "#0E7C86",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
