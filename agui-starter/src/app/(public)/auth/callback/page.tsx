"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase, syncSession } from "@/lib/auth/client";

async function syncSessionOrThrow() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  await syncSession(data.session ?? null);
}

function cleanUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("next");
  const query = url.searchParams.toString();
  window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
}

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    (async () => {
      const rawNext = searchParams.get("next");
      const nextPath = rawNext && rawNext.startsWith("/") ? rawNext : "/me";

      try {
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (
          typeof window !== "undefined" &&
          window.location.hash.includes("access_token")
        ) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }

        await syncSessionOrThrow();

        if (!active) return;
        cleanUrl();
        router.replace(nextPath);
      } catch (error) {
        console.error("Auth finalize error:", error);
        if (!active) return;
        cleanUrl();
        const redirectUrl = rawNext
          ? `/welcome?error=auth&next=${encodeURIComponent(rawNext)}`
          : "/welcome?error=auth";
        router.replace(redirectUrl);
      }
    })();

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
