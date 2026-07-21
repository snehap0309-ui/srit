import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_TOKEN_COOKIE = "ps_admin_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }
  // Soft gate: HttpOnly session cookie must exist for dashboard routes.
  // Full admin check still happens via /auth/me in the dashboard layout.
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
    if (!token) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login/:path*"],
};
