import { NextResponse, type NextRequest } from "next/server";

/**
 * Access log for page requests, so the frontend's container logs show traffic.
 * Next.js logs nothing per request in production on its own. Static assets and the
 * health check are excluded (see `matcher`); query strings are never logged.
 */
export function proxy(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "-";
  console.log(`${new Date().toISOString()}  INFO access: ${request.method} ${request.nextUrl.pathname} ip=${ip}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next's assets, the runtime config (polled by the health check), and files with an extension
    "/((?!_next/|api/config|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
