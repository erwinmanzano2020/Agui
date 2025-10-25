"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ScanAdopt({ companyId }: { companyId: string }) {
  const [barcode, setBarcode] = React.useState("");
  const [nameHint, setNameHint] = React.useState("");
  const [price, setPrice] = React.useState<number>(0);
  const [sku, setSku] = React.useState("");
  const [log, setLog] = React.useState<string>("// Ready");

  async function adopt(e: React.FormEvent) {
    e.preventDefault();
    setLog((s) => s + `\n> adopt ${barcode}`);
    const res = await fetch("/api/inventory/adopt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId,
        barcode,
        priceCentavos: Math.round(Number(price) * 100),
        sku,
        nameHint: nameHint || undefined,
      }),
    }).then((r) => r.json());
    setLog((s) => s + `\n${JSON.stringify(res, null, 2)}`);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="py-6 space-y-3">
          <div className="text-lg font-semibold">Scan / Adopt Item</div>
          <form onSubmit={adopt} className="space-y-3">
            <label className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
              <span className="text-muted-foreground">Barcode</span>
              <input
                className="h-9 px-3 rounded-[var(--agui-radius)] bg-card border border-border"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or paste barcode"
                required
              />
            </label>
            <label className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
              <span className="text-muted-foreground">Name hint</span>
              <input
                className="h-9 px-3 rounded-[var(--agui-radius)] bg-card border border-border"
                value={nameHint}
                onChange={(e) => setNameHint(e.target.value)}
                placeholder="Optional when creating placeholder"
              />
            </label>
            <label className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
              <span className="text-muted-foreground">SKU</span>
              <input
                className="h-9 px-3 rounded-[var(--agui-radius)] bg-card border border-border"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
              <span className="text-muted-foreground">Price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="h-9 px-3 rounded-[var(--agui-radius)] bg-card border border-border"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                placeholder="0.00"
              />
            </label>
            <Button type="submit">Adopt</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <div className="text-sm text-muted-foreground mb-2">Debug</div>
          <pre className="text-xs bg-muted p-3 rounded-[var(--agui-radius)] overflow-auto min-h-[240px] whitespace-pre-wrap">
            {log}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
