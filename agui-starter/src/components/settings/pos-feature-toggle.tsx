"use client";

import { useState, useTransition } from "react";

import { setPosEnabled } from "@/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PosFeatureToggleProps = {
  initialEnabled: boolean;
};

export default function PosFeatureToggle({ initialEnabled }: PosFeatureToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    const previous = enabled;
    const next = !enabled;
    setEnabled(next);

    startTransition(async () => {
      try {
        await setPosEnabled(next);
      } catch (error) {
        console.error("Failed to update POS flag", error);
        setEnabled(previous);
      }
    });
  };

  return (
    <div className="rounded-[var(--agui-radius)] border border-border bg-card/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Enable POS</span>
            <Badge tone="on">Beta</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Lights up the POS shell so your team can explore the beta experience.
          </p>
        </div>
        <Button
          type="button"
          variant={enabled ? "solid" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={pending}
          aria-pressed={enabled}
        >
          {pending ? "Saving…" : enabled ? "On" : "Off"}
        </Button>
      </div>
    </div>
  );
}
