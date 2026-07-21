import { NextResponse } from "next/server";
import { ADMIN_TOKEN_COOKIE } from "@/lib/backendUrl";

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true, message: "Logged out" });

  const xfProto = request.headers.get("x-forwarded-proto");
  const secure = xfProto
    ? xfProto.split(",")[0].trim() === "https"
    : (() => {
        try {
          return new URL(request.url).protocol === "https:";
        } catch {
          return false;
        }
      })();

  response.cookies.set(ADMIN_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
