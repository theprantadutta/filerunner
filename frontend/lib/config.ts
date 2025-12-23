// Runtime configuration
// Fetches API_URL from server at runtime, not build time

let cachedApiUrl: string | null = null;

export const getApiUrl = (): string => {
  // Return cached value if available
  if (cachedApiUrl) {
    return cachedApiUrl;
  }

  // Server-side: read directly from environment
  if (typeof window === "undefined") {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  }

  // Client-side: check if we have a cached value in window
  if ((window as any).__API_URL__) {
    cachedApiUrl = (window as any).__API_URL__;
    return cachedApiUrl!;
  }

  // Fallback: auto-detect from current location
  const { protocol, hostname, port } = window.location;
  let backendPort = "8000";
  const currentPort = port || (protocol === "https:" ? "443" : "80");

  if (currentPort !== "3000" && currentPort !== "80" && currentPort !== "443") {
    backendPort = String(Number(currentPort) - 1);
  }

  return `${protocol}//${hostname}:${backendPort}/api`;
};

// Get base URL without /api suffix (for file URLs that already include /api)
export const getBaseUrl = (): string => {
  const apiUrl = getApiUrl();
  // Remove trailing /api if present
  return apiUrl.replace(/\/api\/?$/, "");
};

// Fetch config from server and cache it
export const initConfig = async (): Promise<void> => {
  if (typeof window === "undefined" || cachedApiUrl) {
    return;
  }

  try {
    const res = await fetch("/api/config");
    const config = await res.json();
    if (config.apiUrl) {
      cachedApiUrl = config.apiUrl;
      (window as any).__API_URL__ = config.apiUrl;
    }
  } catch (e) {
    // Config endpoint not available, use auto-detection
    console.warn("Failed to fetch config, using auto-detection");
  }
};
