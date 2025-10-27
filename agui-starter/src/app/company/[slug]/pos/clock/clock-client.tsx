"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";

export type ClockEventRecord = {
  id: string;
  houseId: string;
  kind: "IN" | "OUT";
  createdAt: string;
};

type ClockClientProps = {
  houseId: string;
  houseName: string;
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function ClockClient({ houseId, houseName }: ClockClientProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<ClockEventRecord | null>(null);

  const fetchLatest = useCallback(async () => {
    setInitialLoading(true);
    try {
      const response = await fetch(`/api/clock?houseId=${encodeURIComponent(houseId)}`);
      const payload = await response.json();
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? "Failed to load clock events");
      }
      if (payload.lastEvent) {
        setLastEvent({
          id: payload.lastEvent.id,
          houseId,
          kind: payload.lastEvent.kind,
          createdAt: payload.lastEvent.createdAt,
        });
      } else {
        setLastEvent(null);
      }
    } catch (error) {
      console.error("Failed to load clock events", error);
      toast.error(error instanceof Error ? error.message : "Failed to load clock events");
    } finally {
      setInitialLoading(false);
    }
  }, [houseId, toast]);

  useEffect(() => {
    fetchLatest().catch((error) => {
      console.error("Failed to initialize clock events", error);
      setInitialLoading(false);
    });
  }, [fetchLatest]);

  const handleClock = useCallback(
    async (kind: "IN" | "OUT") => {
      setLoading(true);
      try {
        const response = await fetch("/api/clock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ houseId, kind }),
        });
        const payload = await response.json();
        if (!response.ok || payload?.error) {
          throw new Error(payload?.error ?? "Failed to record clock event");
        }
        const event = payload.event as ClockEventRecord;
        setLastEvent(event);
        toast.success(kind === "IN" ? "Clocked in" : "Clocked out");
      } catch (error) {
        console.error("Failed to record clock event", error);
        toast.error(error instanceof Error ? error.message : "Failed to record clock event");
      } finally {
        setLoading(false);
      }
    },
    [houseId, toast],
  );

  const lastStatus = useMemo(() => {
    if (!lastEvent) return "No history yet";
    return lastEvent.kind === "IN" ? "Last clock in" : "Last clock out";
  }, [lastEvent]);

  return (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{houseName} — Time Clock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => handleClock("IN")} disabled={loading}>
              {loading ? "Processing…" : "Clock In"}
            </Button>
            <Button variant="outline" onClick={() => handleClock("OUT")} disabled={loading}>
              {loading ? "Processing…" : "Clock Out"}
            </Button>
          </div>
          <div className="rounded-[var(--agui-radius)] border border-border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-muted-foreground">{lastStatus}</div>
            <div>{initialLoading ? "Loading…" : formatTimestamp(lastEvent?.createdAt)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
