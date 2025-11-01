// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/auth/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/me";
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState<string>("Signing you in…");

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // Supabase auto-detects the URL hash (`#access_token=...`) on this public page.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (!session) throw new Error("Missing session");

        // Trigger cookie sync (Next server can see it on SSR)
        const response = await fetch("/api/auth/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "SIGNED_IN", session }),
        });

        if (!response.ok) {
          throw new Error(`Session sync failed (${response.status})`);
        }

        if (!mounted) return;
        setStatus("ok");
        setMessage("Success! Redirecting…");

        router.replace(next);
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setStatus("error");
        setMessage("Sign-in failed. Please try again.");
      }
    }
    run();

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
