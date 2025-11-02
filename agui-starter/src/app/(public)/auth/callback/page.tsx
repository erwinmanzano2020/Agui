"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase, syncSession } from "@/lib/auth/client";

function resolveNextPath(raw: string | null): string {
  if (!raw) return "/me";
  if (!raw.startsWith("/")) return "/me";
  if (raw.startsWith("//")) return "/me";
  return raw;
}

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = useMemo(() => resolveNextPath(searchParams.get("next")), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const completeSignIn = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.getSession();
          if (error) throw error;
        }

        await syncSession();

        if (!cancelled) {
          router.replace(destination);
        }
      } catch (error) {
        console.error("Failed to finalize authentication", error);
        if (!cancelled) {
          router.replace("/welcome?error=auth");
        }
      }
    };

    void completeSignIn();

    return () => {
      cancelled = true;
    };
  }, [destination, router]);

  return null;
}
