"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { newCart, addOrBumpLine, priceLines } from "@/lib/pos/cart";
import { loadLocalCart, saveLocalCart } from "@/lib/pos/local";
import type { Cart } from "@/lib/pos/types";

type InventorySearchResponse = {
  items?: Array<{ id: string; name: string }>;
};

type HoldResponse = { ok?: boolean; saleId?: string; error?: string };

type ResumeSale = {
  id: string;
  device_id: string;
  status: Cart["status"];
  grand_total_centavos: number;
  version: number;
};

type ResumeLine = {
  line_no: number;
  item_id: string;
  uom: string;
  multiplier: number;
  qty: number | string;
  unit_price_centavos: number;
  line_total_centavos: number;
};

type ResumeResponse = {
  sale?: ResumeSale;
  lines?: ResumeLine[];
  error?: string;
};

type FinalizeResponse = { ok?: boolean; saleId?: string; error?: string; idempotent?: boolean };

function deviceId() {
  const existing = localStorage.getItem("agui:device");
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem("agui:device", generated);
  return generated;
}

export default function PosClient({ companyId, companySlug }: { companyId: string; companySlug: string }) {
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [scanBuf, setScanBuf] = React.useState("");
  const dev = React.useMemo(() => deviceId(), []);

  React.useEffect(() => {
    const saved = loadLocalCart(companyId, dev);
    setCart(saved ?? newCart(companyId, dev));
  }, [companyId, dev]);

  React.useEffect(() => {
    if (cart) saveLocalCart(cart);
  }, [cart]);

  const adoptByBarcode = React.useCallback(async (code: string) => {
    const res = (await fetch(`/api/inventory/search?q=${encodeURIComponent(code)}`).then(r => r.json())) as InventorySearchResponse;
    const item = res.items?.[0];
    if (!item) return;

    setCart(current => {
      if (!current) return current;
      const unitPriceCentavos = 0;
      const next = addOrBumpLine(current, {
        itemId: item.id,
        name: item.name,
        uom: "UNIT",
        multiplier: 1,
        qty: 1,
        unitPrice: unitPriceCentavos,
      });

      return { ...next, localSeq: current.localSeq + 1 };
    });
  }, []);

  const holdSale = React.useCallback(async () => {
    if (!cart) return;

    const payload = {
      companyId,
      deviceId: cart.deviceId,
      saleId: cart.saleId,
      version: cart.version,
      grandTotalCentavos: cart.grandTotal,
      lines: cart.lines.map(line => ({
        itemId: line.itemId,
        uom: line.uom,
        multiplier: line.multiplier,
        qty: line.qty,
        unitPriceCentavos: line.unitPrice,
        lineTotalCentavos: line.lineTotal,
      })),
      reason: prompt("Reason for hold?") || undefined,
    };

    const res = (await fetch("/api/pos/hold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(r => r.json())) as HoldResponse;

    if (res?.saleId) {
      setCart(current =>
        current
          ? { ...current, saleId: res.saleId, status: "HELD", version: (current.version ?? 0) + 1 }
          : current,
      );
      alert("Held.");
    }
  }, [cart, companyId]);

  const resumeSale = React.useCallback(async () => {
    const res = (await fetch("/api/pos/resume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId }),
    }).then(r => r.json())) as ResumeResponse;

    if (res?.sale) {
      const lines = (res.lines ?? []).map(line => ({
        lineNo: line.line_no,
        itemId: line.item_id,
        name: "",
        uom: line.uom,
        multiplier: line.multiplier,
        qty: Number(line.qty),
        unitPrice: line.unit_price_centavos,
        lineTotal: line.line_total_centavos,
      }));

      const next = priceLines({
        companyId,
        deviceId: res.sale.device_id,
        saleId: res.sale.id,
        status: res.sale.status,
        lines,
        grandTotal: res.sale.grand_total_centavos,
        version: res.sale.version,
        localSeq: 0,
      });

      setCart(next);
    } else {
      alert(res?.error || "No held sale.");
    }
  }, [companyId]);

  const finalizeSale = React.useCallback(async () => {
    if (!cart) return;

    const payload = {
      companyId,
      deviceId: cart.deviceId,
      localSeq: cart.localSeq + 1,
      saleId: cart.saleId,
      version: cart.version,
      grandTotalCentavos: cart.grandTotal,
      lines: cart.lines.map(line => ({
        itemId: line.itemId,
        uom: line.uom,
        multiplier: line.multiplier,
        qty: line.qty,
        unitPriceCentavos: line.unitPrice,
        lineTotalCentavos: line.lineTotal,
      })),
    };

    const res = (await fetch("/api/pos/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(r => r.json())) as FinalizeResponse;

    if (res?.saleId) {
      const print = confirm("Print receipt? (Y=yes, N=no)");
      setCart(current => {
        const base = newCart(companyId, dev);
        return { ...base, localSeq: (current?.localSeq ?? 0) + 1 };
      });
      if (print) {
        console.log("Print receipt for sale", res.saleId);
      }
    } else {
      alert(res?.error || "Finalize failed");
    }
  }, [cart, companyId, dev]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F9") {
        event.preventDefault();
        holdSale();
        return;
      }

      if (event.key === "F12") {
        event.preventDefault();
        finalizeSale();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [holdSale, finalizeSale]);

  if (!cart) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">POS — {companySlug}</div>
            <div className="text-xs text-muted-foreground">F9 Hold • F12 Finalize</div>
          </div>

          <form
            onSubmit={event => {
              event.preventDefault();
              const code = scanBuf.trim();
              if (code) {
                adoptByBarcode(code);
                setScanBuf("");
              }
            }}
          >
            <input
              autoFocus
              value={scanBuf}
              onChange={event => setScanBuf(event.target.value)}
              placeholder="Scan barcode…"
              className="h-10 w-full rounded-[var(--agui-radius)] border border-border bg-card px-3"
            />
          </form>

          <div className="rounded-[var(--agui-radius)] border border-border">
            <div className="grid grid-cols-6 px-3 py-2 text-xs text-muted-foreground border-b border-border">
              <div className="col-span-3">Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Price</div>
              <div className="text-right">Total</div>
            </div>
            {cart.lines.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Scan an item to add to cart.</div>
            ) : (
              cart.lines.map(line => (
                <div key={line.lineNo} className="grid grid-cols-6 px-3 py-2 border-t border-border text-sm">
                  <div className="col-span-3">{line.name || line.itemId.slice(0, 8)}</div>
                  <div className="text-right">{line.qty}</div>
                  <div className="text-right font-mono">₱{(line.unitPrice / 100).toFixed(2)}</div>
                  <div className="text-right font-mono">₱{(line.lineTotal / 100).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-6">
            <div className="text-sm text-muted-foreground">Grand Total</div>
            <div className="text-xl font-semibold font-mono">₱{(cart.grandTotal / 100).toFixed(2)}</div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={resumeSale}>
              Resume (F9)
            </Button>
            <Button type="button" variant="outline" onClick={holdSale}>
              Hold (F9)
            </Button>
            <Button type="button" onClick={finalizeSale}>
              Finalize (F12)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground mb-2">Debug snapshot</div>
          <pre className="text-xs bg-muted p-3 rounded-[var(--agui-radius)] overflow-auto h-[520px]">
            {JSON.stringify(cart, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
