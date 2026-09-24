import type { MetadataRoute } from "next";

// Relative URLs resolve against the manifest's own URL, so this works under NEXT_PUBLIC_BASE_PATH too
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FileRunner",
    short_name: "FileRunner",
    description: "Self-hosted file storage and CDN",
    start_url: "./dashboard",
    scope: "./",
    display: "standalone",
    background_color: "#F4F5F8",
    theme_color: "#15161B",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
