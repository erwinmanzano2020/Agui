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
      const nextPath = searchParams.get("next") || "/me";
      const cleanUrl = () => {
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.delete("code");
        url.searchParams.delete("next");
        const query = url.searchParams.toString();
        window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
      };

      try {

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await syncSession(data.session ?? null);
        } else {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            await syncSession(data.session ?? null);
          } else {
            const { data } = await supabase.auth.getSession();
            await syncSession(data.session ?? null);
          }
        }

        if (active) {
          cleanUrl();
          router.replace(nextPath);
        }
      } catch (error) {
        console.error("Failed to finalize authentication", error);
        if (active) {
          cleanUrl();
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
