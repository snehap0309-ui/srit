import { NextResponse } from "next/server";
import { ADMIN_TOKEN_COOKIE, getBackendApiBaseUrl } from "@/lib/backendUrl";
import { isAdminUser } from "@/lib/api";

function cookieSecureFlag(request: Request): boolean {
  // Never force Secure on plain HTTP (LAN IP / localhost) or the browser drops the cookie
  // and every dashboard navigation looks like a logout.
  const xfProto = request.headers.get("x-forwarded-proto");
  if (xfProto) return xfProto.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 });
  }

  const backendRes = await fetch(`${getBackendApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    return NextResponse.json(
      { success: false, message: payload?.message || "Login failed", code: payload?.code },
      { status: backendRes.status },
    );
  }

  const data = payload?.data;
  const user = data?.user;
  const accessToken = data?.accessToken;
  if (!accessToken || !user || !isAdminUser(user)) {
    return NextResponse.json(
      { success: false, message: "This account is not an admin." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    success: true,
    data: { user },
    message: "Login successful",
  });

  response.cookies.set(ADMIN_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: cookieSecureFlag(request),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // align with 1h access token default
  });

  return response;
}
