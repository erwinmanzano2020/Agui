"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/session-context";

type AcceptInviteResponse = {
  ok?: boolean;
  scope?: "HOUSE" | "GUILD";
  houseId?: string | null;
  guildId?: string | null;
  error?: string;
};

export default function AcceptInvitePage() {
  const { supabase, status: sessionStatus, user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const hasAttemptedRef = useRef(false);

  const token = useMemo(() => searchParams?.get("token")?.trim() ?? "", [searchParams]);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    setErrorMessage(null);
  }, [token]);

  const handleSendMagicLink = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!supabase) {
        toast.error("Supabase is not available");
        return;
      }

      if (!email.trim()) {
        toast.error("Enter the email address that received the invite");
        return;
      }

      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const redirectTo = origin
        ? `${origin}/accept-invite${token ? `?token=${encodeURIComponent(token)}` : ""}`
        : undefined;

      setSendingEmail(true);
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
        });
        if (error) {
          throw error;
        }
        toast.success("Check your email for the sign-in link.");
      } catch (error) {
        console.error("Failed to send magic link", error);
        toast.error(error instanceof Error ? error.message : "Failed to send sign-in email");
      } finally {
        setSendingEmail(false);
      }
    },
    [email, supabase, toast, token],
  );

  useEffect(() => {
    if (!token || !supabase || !isAuthenticated || sessionStatus !== "ready") {
      return;
    }
    if (accepting || accepted || hasAttemptedRef.current) {
      return;
    }

    hasAttemptedRef.current = true;
    setAccepting(true);
    setErrorMessage(null);

    const acceptInvite = async () => {
      try {
        const response = await fetch("/api/invites/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json()) as AcceptInviteResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to accept invite");
        }

        let destination: string | null = null;
        if (payload.scope === "HOUSE" && payload.houseId) {
          const { data } = await supabase
            .from("houses")
            .select("slug")
            .eq("id", payload.houseId)
            .maybeSingle();
          destination = data?.slug ? `/company/${data.slug}` : "/";
        } else if (payload.scope === "GUILD" && payload.guildId) {
          const { data } = await supabase
            .from("guilds")
            .select("slug")
            .eq("id", payload.guildId)
            .maybeSingle();
          destination = data?.slug ? `/guild/${data.slug}` : "/";
        }

        setAccepted(true);
        toast.success("Invite accepted");
        router.replace(destination ?? "/");
      } catch (error) {
        console.error("Failed to accept invite", error);
        setErrorMessage(error instanceof Error ? error.message : "Failed to accept invite");
        hasAttemptedRef.current = false;
      } finally {
        setAccepting(false);
      }
    };

    acceptInvite().catch((error) => {
      console.error("Unexpected invite acceptance failure", error);
      setErrorMessage("Failed to accept invite");
      setAccepting(false);
      hasAttemptedRef.current = false;
    });
  }, [token, supabase, isAuthenticated, sessionStatus, accepting, accepted, toast, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color-mix(in_srgb,_var(--agui-surface)_94%,_white_6%)] px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h3 className="text-lg font-semibold">Accept invite</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-muted-foreground">Missing invite token. Check your email link.</p>
          ) : isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Processing your invite…
              </p>
              {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
              {accepting && <p className="text-xs text-muted-foreground">Please wait…</p>}
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handleSendMagicLink}>
              <p className="text-sm text-muted-foreground">
                Enter the email address that received the invite. We&apos;ll send you a sign-in link.
              </p>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
              {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
              <Button type="submit" className="w-full" disabled={sendingEmail}>
                {sendingEmail ? "Sending…" : "Send sign-in link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
