"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { PseudoQrMatrix } from "@/lib/passes/qr";

import { rotateMemberPassToken } from "./actions";
import type { MemberPassState } from "./state";

function PseudoQr({ matrix }: { matrix: PseudoQrMatrix }) {
  if (!matrix.length) {
    return (
      <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 text-xs text-muted-foreground">
        Rotate to generate a QR token
      </div>
    );
  }

  const columns = matrix[0]?.length ?? 0;
  const cellCount = matrix.reduce((acc, row) => acc + row.length, 0);

  return (
    <div
      className="grid rounded-lg border border-border bg-background p-3 shadow-sm"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "1px",
      }}
    >
      {matrix.flatMap((row, y) =>
        row.split("").map((value, x) => (
          <div
            key={`${y}-${x}`}
            className={value === "1" ? "bg-foreground" : "bg-background"}
            style={{
              width: "100%",
              paddingBottom: "100%",
            }}
          />
        )),
      )}
      <span className="sr-only">{cellCount} modules</span>
    </div>
  );
}

type MemberPassCardProps = {
  cardId: string;
  cardNo: string;
  schemeName: string;
  incognitoDefault: boolean;
  initialState: MemberPassState;
};

export function MemberPassCard({
  cardId,
  cardNo,
  schemeName,
  incognitoDefault,
  initialState,
}: MemberPassCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [state, formAction, pending] = useActionState(rotateMemberPassToken, initialState);

  const token = state.token;

  async function handleCopy() {
    if (!token) {
      setCopyStatus("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(token);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy member pass token", error);
      setCopyStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{schemeName}</h2>
          <p className="text-sm text-muted-foreground">Card number {cardNo}</p>
        </div>
        {incognitoDefault && <Badge tone="on">Incognito by default</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col items-center gap-3">
          <PseudoQr matrix={state.matrix} />
          <p className="text-xs text-muted-foreground">Rotate to refresh your QR token.</p>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Token</p>
            <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-sm text-foreground">
              {token ?? "Rotate your pass to reveal a token."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={handleCopy} disabled={!token}>
                {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy token"}
              </Button>
              <form action={formAction} className="flex items-center gap-3">
                <input type="hidden" name="card_id" value={cardId} />
                <Button type="submit" disabled={pending}>
                  {pending ? "Rotating…" : "Rotate QR"}
                </Button>
              </form>
            </div>
          </div>
          {state.status === "error" && state.message && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

