import { NextResponse } from "next/server";

// This API route exposes runtime environment variables to the client
// Unlike NEXT_PUBLIC_* vars which are baked in at build time,
// this reads the actual environment at request time
export async function GET() {
  return NextResponse.json({
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "",
  });
}
