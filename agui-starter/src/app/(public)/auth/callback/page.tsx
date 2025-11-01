// src/app/(public)/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/auth/client";
import { useRouter, useSearchParams } from "next/navigation";

function resolveNextPath(raw: string | null): string {
  if (!raw) return "/me";
  if (!raw.startsWith("/")) return "/me";
  if (raw.startsWith("//")) return "/me";
  return raw;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => resolveNextPath(search.get("next")), [search]);
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Supabase reads the #access_token on this public page
        const { error } = await supabase.auth.getSession();
        if (error) throw error;

        // Server cookie sync
        await fetch("/api/auth/session", { method: "POST" });

        if (!mounted) return;
        setStatus("ok");
        setMessage("Success! Redirecting…");
        router.replace(next);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setStatus("error");
        setMessage("Sign-in failed. Please try again.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, next]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Auth Callback</h1>
        <p className="text-sm opacity-80">{message}</p>
        {status === "error" && (
          <a className="underline mt-3 inline-block" href="/welcome">
            Back to sign in
          </a>
        )}
      </div>
    </main>
  );
}
