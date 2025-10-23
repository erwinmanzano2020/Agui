"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LoyaltyScope } from "@/lib/loyalty/rules";

import { handleClockScan } from "./actions";
import { INITIAL_CLOCK_SCAN_STATE, type ClockScanState } from "./state";

type ScanHudProps = {
  slug: string;
  houseName: string;
  guildName: string | null;
};

const SCOPE_LABELS: Record<LoyaltyScope, string> = {
  ALLIANCE: "Alliance",
  GUILD: "Guild",
  HOUSE: "Company",
};

function formatScope(scope: LoyaltyScope): string {
  return SCOPE_LABELS[scope] ?? scope;
}

function formatPoints(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function normalizeRole(role: string): string {
  const cleaned = role.replace(/[_-]+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

const textareaClasses = cn(
  "min-h-[88px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function StatusBanner({ state }: { state: ClockScanState }) {
  if (!state.message) return null;

  const toneClasses =
    state.status === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : state.status === "needs-override"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div className={cn("rounded-md px-3 py-2 text-sm", toneClasses)}>
      {state.message}
    </div>
  );
}

export function ScanHud({ slug, houseName, guildName }: ScanHudProps) {
  const [state, formAction, pending] = useActionState(handleClockScan, INITIAL_CLOCK_SCAN_STATE);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = tokenInputRef.current;
    if (!input) return;

    if (state.status === "resolved" || state.status === "needs-override" || state.status === "error") {
      input.value = "";
    }

    if (!pending) {
      input.focus();
    }
  }, [state.status, pending]);

  const resolution = state.resolution;

  const scopeLabel = useMemo(() => {
    if (!resolution) return null;
    return formatScope(resolution.schemeScope);
  }, [resolution]);

  const tokenExpiry = useMemo(() => formatTimestamp(resolution?.tokenExpiresAt ?? null), [resolution?.tokenExpiresAt]);

  const linkedCards = useMemo(() => {
    if (!resolution) return [];
    return [...resolution.linkedCards].sort((a, b) => a.precedence - b.precedence);
  }, [resolution]);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="mode" value="resolve" />
        <input type="hidden" name="slug" value={slug} />
        <label htmlFor="scan-token" className="text-sm font-medium text-foreground">
          Scan token
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            id="scan-token"
            name="token"
            ref={tokenInputRef}
            placeholder="Scan or paste a QR token"
            required
            disabled={pending}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={pending} className="sm:w-40">
            {pending ? "Resolving…" : "Resolve scan"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Scans are scoped to {houseName}. {guildName ? `${guildName} guild` : "Your guild"} staff can log overrides for auditing.
        </p>
      </form>

      <StatusBanner state={state} />

      {resolution && (
        <Card className="border-border/80 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {scopeLabel && <Badge tone="on">{scopeLabel}</Badge>}
              {resolution.incognitoActive && <Badge tone="off">Incognito</Badge>}
              {!resolution.incognitoActive && resolution.incognitoDefault && (
                <Badge tone="on">Incognito lifted</Badge>
              )}
              {tokenExpiry && (
                <span className="text-xs text-muted-foreground">Token expires {tokenExpiry}</span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{resolution.schemeName}</h2>
              <p className="text-sm text-muted-foreground">Card number {resolution.cardNo}</p>
              <p className="text-sm text-muted-foreground">{resolution.entityName}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {resolution.loyaltyAccount && (
              <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
                  <p className="text-sm text-foreground">{resolution.loyaltyAccount.accountNo}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Points</p>
                  <p className="text-sm text-foreground">{formatPoints(resolution.loyaltyAccount.points)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tier</p>
                  <p className="text-sm text-foreground">
                    {resolution.loyaltyAccount.tier ? resolution.loyaltyAccount.tier : "—"}
                  </p>
                </div>
              </div>
            )}

            {state.event && (
              <div className="rounded-md border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Override recorded</p>
                <p>
                  {state.event.liftedIncognito ? "Incognito lifted" : "Lower-precedence card allowed"} · {state.event.reason}
                </p>
                <p>{formatTimestamp(state.event.recordedAt)}</p>
              </div>
            )}

            {state.status === "needs-override" && resolution.higherCard && (
              <div className="space-y-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
                <div>
                  <p className="font-medium text-foreground">Higher card detected</p>
                  <p className="text-sm text-muted-foreground">
                    {resolution.higherCard.schemeName} ({formatScope(resolution.higherCard.scope)}) · Card {resolution.higherCard.cardNo}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ask for the higher-precedence credential. If the patron needs this scan anyway, record a reason below.
                </p>
                <form action={formAction} className="space-y-3">
                  <input type="hidden" name="mode" value="override-lower" />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="token_id" value={resolution.tokenId} />
                  <input type="hidden" name="card_id" value={resolution.cardId} />
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="override-reason">
                    Reason to override
                  </label>
                  <textarea
                    id="override-reason"
                    name="reason"
                    required
                    placeholder="Patron lost primary card"
                    className={textareaClasses}
                    disabled={pending}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Overrides are saved to the scan log for audit.
                    </p>
                    <Button type="submit" disabled={pending} className="sm:w-48">
                      {pending ? "Recording…" : "Override and continue"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {resolution.incognitoActive && (
              <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Incognito is active</p>
                <p>Cross-scope details stay hidden. Lift incognito with a reason if you need to verify wider access.</p>
                <form action={formAction} className="space-y-3">
                  <input type="hidden" name="mode" value="lift-incognito" />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="token_id" value={resolution.tokenId} />
                  <input type="hidden" name="card_id" value={resolution.cardId} />
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="incognito-reason">
                    Reason to lift incognito
                  </label>
                  <textarea
                    id="incognito-reason"
                    name="reason"
                    required
                    placeholder="Fraud check with guild lead"
                    className={textareaClasses}
                    disabled={pending}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">This note will appear in the scan log.</p>
                    <Button type="submit" disabled={pending} className="sm:w-48">
                      {pending ? "Recording…" : "Lift incognito"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {!resolution.incognitoActive && linkedCards.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked credentials</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {linkedCards.map((card) => (
                    <li key={card.cardId}>
                      <span className="font-medium text-foreground">{card.schemeName}</span> · {formatScope(card.scope)} card {card.cardNo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!resolution.incognitoActive && (resolution.houseRoles.length > 0 || resolution.guildRoles.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {resolution.houseRoles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">House roles</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {resolution.houseRoles.map((role) => (
                        <li key={role}>{normalizeRole(role)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {resolution.guildRoles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Guild roles</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {resolution.guildRoles.map((role) => (
                        <li key={role}>{normalizeRole(role)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {resolution.incognitoActive && (
              <p className="text-xs text-muted-foreground">
                Additional roles and linked credentials stay hidden while incognito is on.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="mode" value="reset" />
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            Clear
          </Button>
        </form>
      </div>
    </div>
  );
}
