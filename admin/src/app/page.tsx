"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/services/auth";
import { isAdminUser } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getMe();
        if (cancelled) return;
        router.replace(isAdminUser(user) ? "/dashboard" : "/login");
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
    </div>
  );
}
