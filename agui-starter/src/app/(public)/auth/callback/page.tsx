"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/auth/client";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/agui", [searchParams]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await supabase.auth.getSession();
      } catch (error) {
        console.error("Failed to process Supabase session", error);
      }

      if (active) {
        router.replace(next);
      }
    })();

    return () => {
      active = false;
    };
  }, [next, router]);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="text-sm text-muted-foreground">Signing you in…</div>
    </main>
  );
}
