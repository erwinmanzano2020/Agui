"use client";

import * as React from "react";

import { HintChip } from "@/components/ui/hint-chip";
import { sendMagicLink } from "@/lib/auth/client";

export default function WelcomePage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: submitError } = await sendMagicLink(email.trim());
    setLoading(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Welcome to Agui</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your email and we’ll send you a magic link.
        </p>

        {!sent ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block text-sm font-medium" htmlFor="welcome-email">
              Email
            </label>
            <input
              id="welcome-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              className="w-full rounded-md border px-3 py-2 text-base outline-none ring-0 transition focus:border-primary focus:outline-none"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-md bg-primary px-3 py-2 text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        ) : (
          <div className="mt-5 space-y-2 rounded-md bg-muted p-4 text-sm">
            <p>
              Magic link sent to <strong>{email}</strong>.
            </p>
            <p>Open your email and tap the link to continue.</p>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          By continuing, you agree to Agui’s Terms and Privacy Policy.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Need help? Contact support and we’ll get you set up.
        </p>
      </div>

      <HintChip>Launch the tools you need in seconds. Use Ctrl/Cmd + K</HintChip>
    </main>
  );
}
