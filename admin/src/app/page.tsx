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
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status ?? err?.status;
        // Stay off dashboard only when unauthenticated; otherwise retry dashboard.
        router.replace(status === 401 || status === 403 ? "/login" : "/dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot redirect once
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
    </div>
  );
}
