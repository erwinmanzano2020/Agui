"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/session-context";
import { getSiteUrl } from "@/lib/site-url";

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

export default function SignInPage() {
  const { supabase, status: sessionStatus, user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const nextParam = searchParams.get("next");
  const nextPath = useMemo(() => sanitizeNextPath(nextParam), [nextParam]);
  const authError = searchParams.get("error_description");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(authError);
  const [activeOAuthProvider, setActiveOAuthProvider] = useState<"google" | "apple" | null>(null);
  const supabaseUnavailable = !supabase || sessionStatus === "error";
  const redirectOrigin = useMemo(() => getSiteUrl(), []);
  const googleOAuthEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== "false";
  const appleOAuthEnabled = process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true";

  useEffect(() => {
    if (sessionStatus === "ready" && user) {
      router.replace(nextPath);
    }
  }, [nextPath, router, sessionStatus, user]);

  useEffect(() => {
    if (supabaseUnavailable) {
      setError("Supabase is not configured. Set the Supabase env vars to enable sign-in.");
    }
  }, [supabaseUnavailable]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (supabaseUnavailable) {
        setError("Supabase is not configured. Configure env vars to enable sign-in.");
        return;
      }

      if (!email.trim()) {
        setError("Enter an email address to continue.");
        return;
      }

      setStatus("sending");
      setError(null);
      setMessage(null);

      try {
        const redirectQuery = nextParam && nextParam.startsWith("/") ? `?next=${encodeURIComponent(nextParam)}` : "";
        const redirectTo = `${redirectOrigin}/signin${redirectQuery}`;
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (signInError) {
          throw signInError;
        }

        setStatus("sent");
        setMessage("Check your email for a magic link or one-time passcode.");
      } catch (signInError) {
        console.error("Failed to request sign-in link", signInError);
        setStatus("error");
        setError(signInError instanceof Error ? signInError.message : "Failed to send sign-in link.");
      }
    },
    [email, nextParam, redirectOrigin, supabase, supabaseUnavailable],
  );

  const handleEmailChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    if (error) {
      setError(null);
    }
    if (status === "sent" || status === "error") {
      setStatus("idle");
      setMessage(null);
    }
  }, [error, status]);

  const handleOAuthSignIn = useCallback(
    async (provider: "google" | "apple") => {
      if (supabaseUnavailable || !supabase) {
        toast.error("Supabase is not configured. Configure env vars to enable sign-in.");
        return;
      }

      setActiveOAuthProvider(provider);
      try {
        const { error: signInError } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: redirectOrigin },
        });

        if (signInError) {
          toast.error(signInError.message);
        }
      } catch (signInError) {
        toast.error(
          signInError instanceof Error ? signInError.message : "Failed to start OAuth sign-in."
        );
      } finally {
        setActiveOAuthProvider(null);
      }
    },
    [redirectOrigin, supabase, supabaseUnavailable, toast]
  );

  const oauthBusy = activeOAuthProvider !== null;

  return (
    <div className="min-h-screen bg-[color-mix(in_srgb,_var(--agui-surface)_94%,_white_6%)] px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6">
        <Card className="w-full border border-border/70 shadow-soft">
          <CardHeader className="border-none px-6 pt-6 pb-2">
            <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              We’ll email you a magic link or one-time passcode to access Agui.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="flex flex-col gap-2 text-sm text-muted-foreground">
                Email address
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <Button type="submit" disabled={status === "sending" || supabaseUnavailable} className="w-full">
                {status === "sending" ? "Sending link…" : "Send magic link"}
              </Button>
            </form>

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!googleOAuthEnabled || supabaseUnavailable || oauthBusy}
                title={!googleOAuthEnabled ? "Not configured" : undefined}
                onClick={() => handleOAuthSignIn("google")}
              >
                {activeOAuthProvider === "google" ? "Connecting…" : "Continue with Google"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!appleOAuthEnabled || supabaseUnavailable || oauthBusy}
                title={!appleOAuthEnabled ? "Not configured" : undefined}
                onClick={() => handleOAuthSignIn("apple")}
              >
                {activeOAuthProvider === "apple" ? "Connecting…" : "Continue with Apple"}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
