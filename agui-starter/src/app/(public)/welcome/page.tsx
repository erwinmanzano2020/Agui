"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { sendMagicLink, supabase, syncSession } from "@/lib/auth/client";

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth" ? "We couldn’t sign you in. Try again." : null,
  );

  useEffect(() => {
    let cancelled = false;

    const resumeSession = async () => {
      const nextPath = searchParams.get("next") || "/me";

      try {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const hasTokenHash = hash.includes("access_token") || hash.includes("refresh_token");

        if (hasTokenHash && typeof window !== "undefined") {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              throw setSessionError;
            }

            await syncSession(data.session ?? null);

            if (!cancelled) {
              const url = new URL(window.location.href);
              url.hash = "";
              window.history.replaceState(null, "", `${url.pathname}${url.search}`);
              router.replace(nextPath);
            }
            return;
          } else {
            const url = new URL(window.location.href);
            url.hash = "";
            window.history.replaceState(null, "", `${url.pathname}${url.search}`);
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await syncSession(data.session);
          if (!cancelled) {
            router.replace(nextPath);
          }
        }
      } catch (resumeError) {
        console.error("Failed to resume session from welcome", resumeError);
      }
    };

    void resumeSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || status === "sending") {
      return;
    }

    setStatus("sending");
    setError(null);

    const nextPath = searchParams.get("next") || "/me";
    const { ok, error: sendError } = await sendMagicLink(email.trim(), nextPath);
    if (ok) {
      setStatus("sent");
      return;
    }

    setStatus("error");
    setError(sendError ?? "Failed to send magic link.");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-5 py-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Welcome to Agui</h1>
        <p className="text-sm text-muted-foreground">
          Sign in or apply for access to your Agui workspace.
        </p>
      </header>

      <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-soft">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-foreground" htmlFor="welcome-email">
              Email
            </label>
            <input
              id="welcome-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-border px-3 py-2 text-base text-foreground outline-none ring-0 transition focus:border-primary"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setError(null);
                }
                if (status === "sent") {
                  setStatus("idle");
                }
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!email.trim() || status === "sending" || status === "sent"}
            className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "sending" ? "Sending link…" : status === "sent" ? "Link sent" : "Send magic link"}
          </button>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {status === "sent" ? (
            <p className="text-sm text-emerald-600">
              We emailed a magic link to <strong>{email}</strong>. Open it on this device to finish signing in.
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">Need access?</p>
        <Link
          href="/apply"
          className="inline-block rounded-md border border-border/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
        >
          Apply for access
        </Link>
      </section>
    </main>
  );
}
