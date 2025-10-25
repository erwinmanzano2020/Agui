"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSession } from "@/lib/auth/session-context";

function sanitizeNextPath(raw: string | null): string {
  if (!raw) {
    return "/";
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return "/";
  }

  if (!trimmed.startsWith("/")) {
    return "/";
  }

  if (trimmed.startsWith("//")) {
    return "/";
  }

  return trimmed;
}

export default function SignOutPage() {
  const { supabase } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const nextPath = useMemo(() => sanitizeNextPath(nextParam), [nextParam]);
  const [status, setStatus] = useState<"pending" | "done" | "error">("pending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!supabase) {
        setError("Supabase is not configured.");
        setStatus("error");
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (cancelled) {
        return;
      }

      if (signOutError) {
        setError(signOutError.message);
        setStatus("error");
        return;
      }

      setStatus("done");
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (status !== "done") {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.replace(nextPath);
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [nextPath, router, status]);

  return (
    <div className="min-h-screen bg-[color-mix(in_srgb,_var(--agui-surface)_94%,_white_6%)] px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6">
        <Card className="w-full border border-border/70 shadow-soft">
          <CardHeader className="border-none px-6 pt-6 pb-2">
            <h1 className="text-2xl font-semibold text-foreground">Sign out</h1>
            <p className="text-sm text-muted-foreground">Finish signing out of Agui.</p>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 text-sm text-muted-foreground">
            {status === "pending" ? <p>Signing you out…</p> : null}
            {status === "done" ? <p>You’re signed out. Redirecting…</p> : null}
            {status === "error" && error ? <p className="text-red-500">{error}</p> : null}

            <Button
              type="button"
              className="w-full"
              onClick={() => router.replace(nextPath)}
              variant={status === "error" ? "solid" : "ghost"}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
