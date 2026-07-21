/** Absolute backend API base URL for server-side route handlers only. */
export function getBackendApiBaseUrl(): string {
  const fromEnv =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:5000/api/v1";
}

export const ADMIN_TOKEN_COOKIE = "ps_admin_token";
