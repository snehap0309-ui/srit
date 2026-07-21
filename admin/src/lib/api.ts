/** Browser admin client talks to same-origin Next.js proxy (HttpOnly cookie auth). */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/proxy";
  }

  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:5000/api/v1";
}

export function isAdminUser(user: {
  permission?: string;
  role?: string;
  roles?: string[];
  activeMode?: string;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.permission === "ADMIN") return true;
  if (user.role === "ADMIN") return true;
  if (Array.isArray(user.roles) && user.roles.includes("ADMIN")) return true;
  return false;
}
