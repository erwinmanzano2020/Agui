"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Decision = "use_higher" | "issue_lower";

type HudState = {
  scope?: string;
  incognito?: boolean;
  schemeName?: string;
  cardId?: string;
  entityId?: string;
  hasHigherCard?: boolean;
  higherLabel?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  hud?: HudState;
  needsDecision?: boolean;
  error?: string;
};

export default function ScanHUD({ companyId, guildId }: { companyId: string; guildId?: string | null }) {
  const [token, setToken] = React.useState("");
  const [hud, setHud] = React.useState<HudState | null>(null);
  const [needsDecision, setNeedsDecision] = React.useState(false);
  const [response, setResponse] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const requestContext = React.useMemo(() => {
    const context: { scope: "HOUSE"; companyId: string; guildId?: string } = {
      scope: "HOUSE",
      companyId,
    };
    if (typeof guildId === "string" && guildId.length > 0) {
      context.guildId = guildId;
    }
    return context;
  }, [companyId, guildId]);

  const resolve = React.useCallback(
    async (rawToken: string) => {
      if (!rawToken) return;
      setLoading(true);
      setError(null);
      try {
        const httpResponse = await fetch("/api/scan/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: rawToken, context: requestContext }),
        });
        const res: ApiResponse = await httpResponse.json();

        setResponse(JSON.stringify(res, null, 2));

        if (!httpResponse.ok || !res.ok) {
          setHud(null);
          setNeedsDecision(false);
          setError(res.error ?? "Failed to resolve scan");
          return;
        }

        setHud(res.hud ?? null);
        setNeedsDecision(Boolean(res.needsDecision));
      } catch (error) {
        const fallback = { error: (error as Error).message };
        setResponse(JSON.stringify(fallback, null, 2));
        setHud(null);
        setNeedsDecision(false);
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [requestContext],
  );

  const decide = React.useCallback(
    async (decision: Decision, liftIncognito?: boolean) => {
      if (!token) return;
      let reason: string | undefined;
      if (decision === "issue_lower") {
        const reasonInput = window.prompt("Reason for issuing lower card anyway?") ?? "";
        const trimmed = reasonInput.trim();
        if (!trimmed) {
          window.alert("A reason is required to issue the lower-precedence card.");
          return;
        }
        reason = trimmed;
      }
      setLoading(true);
      setError(null);
      try {
        const httpResponse = await fetch("/api/scan/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            decision,
            reason,
            liftIncognito,
            context: requestContext,
          }),
        });
        const res: ApiResponse = await httpResponse.json();

        setResponse(JSON.stringify(res, null, 2));

        if (!httpResponse.ok || !res.ok) {
          setError(res.error ?? "Failed to record decision");
          setNeedsDecision(false);
          setHud(res.hud ?? null);
          return;
        }

        setHud(res.hud ?? null);
        setNeedsDecision(Boolean(res.needsDecision));
      } catch (error) {
        const fallback = { error: (error as Error).message };
        setResponse(JSON.stringify(fallback, null, 2));
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [requestContext, token],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="text-lg font-semibold">Scan</div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              resolve(token);
            }}
            className="flex gap-2"
          >
            <input
              className="h-9 flex-1 rounded-[var(--agui-radius)] border border-border bg-card px-3"
              placeholder="Paste raw token here (dev)"
              value={token}
              disabled={loading}
              onChange={(event) => setToken(event.target.value)}
            />
            <Button type="submit" disabled={loading}>
              Resolve
            </Button>
          </form>

          {error && (
            <div className="rounded-[var(--agui-radius)] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {hud && (
            <div className="space-y-1 rounded-[var(--agui-radius)] border border-border p-3 text-sm">
              <div>
                Scope: <span className="font-medium">{hud.scope ?? "UNKNOWN"}</span>
              </div>
              {hud.incognito && <div className="text-xs text-amber-600">Incognito active</div>}
              <div>
                Scheme: <span className="font-medium">{hud.schemeName ?? "—"}</span>
              </div>
              <div>
                Card: <span className="font-mono">{hud.cardId ?? "hidden"}</span>
              </div>
              <div>
                Entity: <span className="font-mono">{hud.entityId ?? "hidden"}</span>
              </div>
              {hud.hasHigherCard && (
                <div className="text-xs">
                  Higher-level card available: <span className="font-medium">{hud.higherLabel ?? "—"}</span>
                </div>
              )}
            </div>
          )}

          {needsDecision && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={loading} onClick={() => decide("use_higher")}>Use higher card</Button>
              <Button variant="solid" disabled={loading} onClick={() => decide("issue_lower")}>
                Issue lower anyway
              </Button>
              {hud?.incognito && (
                <Button
                  variant="ghost"
                  disabled={loading}
                  onClick={() => decide("use_higher", true)}
                  title="Lift incognito for this scan"
                >
                  Lift incognito
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <div className="mb-2 text-sm text-muted-foreground">Debug</div>
          <pre className="min-h-[240px] overflow-auto rounded-[var(--agui-radius)] bg-muted p-3 text-xs">
            {response || "// resolve to see payload"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
