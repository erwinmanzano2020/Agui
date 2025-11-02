"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase, syncSession } from "@/lib/auth/client";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    const finalize = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (window.location.hash.includes("access_token")) {
          await supabase.auth.getSession();
        }

        await syncSession();

        if (active) {
          const next = searchParams.get("next") || "/me";
          router.replace(next);
        }
      } catch (error) {
        console.error("Failed to finalize authentication", error);
        if (active) {
          const next = searchParams.get("next");
          const redirectUrl = next ? `/welcome?error=auth&next=${encodeURIComponent(next)}` : "/welcome?error=auth";
          router.replace(redirectUrl);
        }
      }
    };

    void finalize();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <p className="text-center text-sm text-muted-foreground">Signing you in…</p>
    </main>
  );
}
