"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase, syncSession } from "@/lib/auth/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const finalizeAuth = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (location.hash.includes("access_token")) {
          await supabase.auth.getSession();
        }

        await syncSession();

        if (!cancelled) {
          router.replace("/me");
        }
      } catch (error) {
        console.error("Failed to finalize authentication", error);
        if (!cancelled) {
          router.replace("/welcome?error=auth");
        }
      }
    };

    void finalizeAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
