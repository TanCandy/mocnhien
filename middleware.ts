// @ts-nocheck
// Next.js middleware (App Router) template for route protection.
// NOTE: This file is only executed by Next.js runtime.
import { NextRequest, NextResponse } from "next/server";

function decodePayload(token: string): any | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const payload = token ? decodePayload(token) : null;
  const role = payload?.role as "user" | "admin" | undefined;
  const isLoggedIn = Boolean(token);

  const isProfilePath = pathname.startsWith("/profile");
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/login";

  if (!isLoggedIn && (isProfilePath || isAdminPath)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLoggedIn && isLoginPath) {
    return NextResponse.redirect(new URL(role === "admin" ? "/admin/dashboard" : "/profile", request.url));
  }

  if (isAdminPath && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*", "/admin/:path*", "/login"],
};

