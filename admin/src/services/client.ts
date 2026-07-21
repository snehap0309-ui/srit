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

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || "Request failed";

    if (status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("user");
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch {
        /* ignore */
      }
      window.location.href = "/login";
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
