import client from "./client";
import type { User, SingleResponse } from "@/types";

export async function login(
  email: string,
  password: string
): Promise<{ user: User }> {
  // Same-origin route sets HttpOnly session cookie — JWT never enters JS.
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(payload?.message || "Login failed");
    err.response = { status: res.status, data: payload };
    throw err;
  }
  return payload.data as { user: User };
}

export async function getMe(): Promise<User> {
  const res = await client.get<SingleResponse<User>>("/auth/me");
  return res.data.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await client.patch("/auth/password", { currentPassword, newPassword });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
  }
}
