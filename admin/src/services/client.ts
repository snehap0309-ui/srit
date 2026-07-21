import axios from "axios";
import { getApiBaseUrl } from "@/lib/api";

const client = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  // Auth token is an HttpOnly cookie attached by the browser to /api/proxy.
  // Never read JWT from localStorage.
  return config;
});

/** Structured API error carrying the backend's machine-readable code (never string-match message). */
export interface ApiErrorLike extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function getApiErrorCode(err: unknown): string | undefined {
  return (err as ApiErrorLike)?.code;
}

let handlingUnauthorized = false;

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  localStorage.removeItem("user");
  // Soft clear cookie; don't block navigation if logout fails.
  void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
    window.location.href = "/login";
  });
}

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || "Request failed";
    const url = String(err.config?.url || "");

    // Only treat session as dead for auth verification failures.
    // Random endpoint 401s (misconfigured routes, missing scopes, etc.) must NOT
    // wipe the admin cookie — that was logging users out on every sidebar click.
    const isAuthMe = url.includes("/auth/me");
    if (status === 401 && typeof window !== "undefined" && isAuthMe) {
      redirectToLogin();
    }

    err.message = status === 429
      ? (message || "Too many requests. Please wait a few minutes and try again.")
      : message;
    err.status = status;
    err.code = err.response?.data?.code;
    err.details = err.response?.data?.details;

    return Promise.reject(err);
  }
);

export default client;
