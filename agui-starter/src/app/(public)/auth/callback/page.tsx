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
      const rawNext = searchParams.get("next");
      const nextPath = rawNext || "/me";
      let encounteredError = false;

      try {
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession({ code });
          if (error) throw error;
        } else if (
          typeof window !== "undefined" &&
          window.location.hash.includes("access_token")
        ) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        encounteredError = true;
      } finally {
        try {
          const { data } = await supabase.auth.getSession();
          await syncSession(data.session ?? null);
        } catch (syncError) {
          console.error("Failed to sync session after auth callback:", syncError);
        }

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.hash = "";
          url.searchParams.delete("code");
          url.searchParams.delete("next");
          const query = url.searchParams.toString();
          window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
        }

        if (active) {
          if (encounteredError) {
            const redirectUrl = rawNext
              ? `/welcome?error=auth&next=${encodeURIComponent(rawNext)}`
              : "/welcome?error=auth";
            router.replace(redirectUrl);
          } else {
            router.replace(nextPath);
          }
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
