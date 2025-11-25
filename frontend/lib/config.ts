// Runtime configuration
// This allows API_URL to be configured at container startup time
// instead of being baked in at build time

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      API_URL?: string;
    };
  }
}

export const getApiUrl = (): string => {
  // 1. Check runtime config (injected at container startup)
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.API_URL) {
    const url = window.__RUNTIME_CONFIG__.API_URL;
    if (url && url !== "" && !url.includes("undefined")) {
      return url;
    }
  }

  // 2. Check build-time env var
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl !== "/api" && !envUrl.includes("undefined")) {
    return envUrl;
  }

  // 3. Auto-detect from current location (client-side only)
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // Default: assume backend is on port 8000
    // If frontend is on a custom port (not 80, 443, or 3000), assume backend is on port-1
    // e.g., frontend on 89 -> backend on 88
    let backendPort = "8000";
    const currentPort = port || (protocol === "https:" ? "443" : "80");

    if (currentPort !== "3000" && currentPort !== "80" && currentPort !== "443") {
      backendPort = String(Number(currentPort) - 1);
    }

    return `${protocol}//${hostname}:${backendPort}/api`;
  }

  // 4. Server-side fallback
  return "http://localhost:8000/api";
};
