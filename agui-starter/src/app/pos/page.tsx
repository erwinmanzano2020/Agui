import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { RequireFeature } from "@/components/auth/RequireFeature";
import { AppFeature } from "@/lib/auth/permissions";
import { loadUiConfig } from "@/lib/ui-config";

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

function formatCentavos(value: number): string {
  return pesoFormatter.format(value / 100);
}

type CartStubLine = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

type HeldSaleStub = {
  token: string;
  summary: string;
  total: number;
  ageLabel: string;
};

type KeymapEntry = {
  combo: string;
  action: string;
  detail: string;
};

type RegisterStub = {
  drawer: string;
  device: string;
  operator: string;
  openedAt: string;
  float: number;
  sessionTotal: number;
};

const ACTIVE_CART: CartStubLine[] = [
  { id: "brew", name: "House Brew 12oz", sku: "HB-12", quantity: 2, unitPrice: 1500 },
  { id: "cookie", name: "Sea Salt Cookie", sku: "CK-44", quantity: 1, unitPrice: 950 },
  { id: "gift", name: "Gift Card Top-up", sku: "GC-50", quantity: 1, unitPrice: 5000 },
];

const HELD_SALES: HeldSaleStub[] = [
  { token: "HLD-482A", summary: "Latte flight · 3 items", total: 6425, ageLabel: "2 min" },
  { token: "HLD-19BC", summary: "Pickup order #138", total: 2800, ageLabel: "12 min" },
  { token: "HLD-7F21", summary: "Bulk beans · 1.5kg", total: 12800, ageLabel: "27 min" },
];

const KEYMAP: KeymapEntry[] = [
  { combo: "F9", action: "Hold sale", detail: "Suspend and issue a pickup token." },
  { combo: "F12", action: "Finalize", detail: "Capture payments and close the register ticket." },
  { combo: "Y", action: "Print receipt", detail: "Confirm printing when prompted after checkout." },
  { combo: "N", action: "Skip print", detail: "Dismiss the receipt prompt without printing." },
];

const REGISTER: RegisterStub = {
  drawer: "Main counter",
  device: "Terminal 03",
  operator: "A. Rivera",
  openedAt: "08:45",
  float: 50000,
  sessionTotal: 182500,
};

function computeCartTotals(lines: CartStubLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.quantity += line.quantity;
      acc.total += line.quantity * line.unitPrice;
      return acc;
    },
    { quantity: 0, total: 0 },
  );
}

export const metadata = { title: "POS" };

export default async function PosPage() {
  const { flags } = await loadUiConfig();
  const posEnabled = Boolean(flags?.pos_enabled);

  if (!posEnabled) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="text-lg font-semibold text-foreground">POS is disabled</div>
            <p className="text-sm text-muted-foreground">
              Turn on the POS feature in Settings → Features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cartTotals = computeCartTotals(ACTIVE_CART);

  return (
    <RequireFeature feature={AppFeature.POS}>
      <div className="space-y-6 p-4 text-foreground md:p-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">
              Cart stub with tiered pricing, hold tokens, and register keymap placeholders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            New Sale
          </Button>
          <Button size="sm">Open Register</Button>
        </div>
      </header>

      <Suspense fallback={<div className="opacity-60">Loading register shell…</div>}>
        <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <Card className="border border-dashed border-border/70">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Active cart</div>
                  <div className="text-lg font-semibold">Walk-in · Register 3</div>
                </div>
                <Badge tone="on">OPEN</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <table className="w-full min-w-[480px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="px-3 py-2 text-left font-medium">Qty</th>
                        <th className="px-3 py-2 text-left font-medium">Unit</th>
                        <th className="px-3 py-2 text-left font-medium">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTIVE_CART.map((line) => {
                        const lineTotal = line.quantity * line.unitPrice;
                        return (
                          <tr key={line.id} className="border-t border-border/60 last:border-b">
                            <td className="px-3 py-3 align-top">
                              <div className="font-medium text-foreground">{line.name}</div>
                              <div className="text-xs text-muted-foreground">SKU {line.sku}</div>
                            </td>
                            <td className="px-3 py-3 align-top font-medium">{line.quantity}</td>
                            <td className="px-3 py-3 align-top text-muted-foreground">{formatCentavos(line.unitPrice)}</td>
                            <td className="px-3 py-3 align-top text-right font-semibold">{formatCentavos(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-dashed border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
                  Scan items with the barcode reader or type a quantity prefix (timeout 2s) before scanning.
                  Duplicate scans within 300ms are ignored by the pricing engine.
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Items</span>
                  <span>{cartTotals.quantity}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Grand total</span>
                  <span>{formatCentavos(cartTotals.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="rounded border px-1">F9</kbd> to hold and generate a token, then <kbd className="rounded border px-1">F12</kbd> to finalize when the guest returns.
                </p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Held queue</div>
                  <div className="text-lg font-semibold">Ready to resume</div>
                </div>
                <Badge tone="off">HELD SALES</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {HELD_SALES.map((sale) => (
                  <div
                    key={sale.token}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="on">{sale.token}</Badge>
                        <span className="text-xs text-muted-foreground">{sale.ageLabel} ago</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{sale.summary}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatCentavos(sale.total)}</div>
                        <div className="text-xs text-muted-foreground">Token stored in sale_holds</div>
                      </div>
                      <Button variant="outline" size="sm">
                        Resume
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Keymap</div>
                <div className="text-lg font-semibold">Touchboard shortcuts</div>
              </CardHeader>
              <CardContent className="space-y-4">
                {KEYMAP.map((entry) => (
                  <div key={entry.combo} className="flex items-start gap-3">
                    <kbd className="rounded border border-border/70 bg-card/70 px-2 py-1 text-xs font-semibold uppercase">
                      {entry.combo}
                    </kbd>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{entry.action}</div>
                      <div className="text-xs text-muted-foreground">{entry.detail}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-dashed border-border/70">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Register session</div>
                  <div className="text-lg font-semibold">{REGISTER.drawer}</div>
                </div>
                <Badge tone="on">SESSION</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Device</span>
                  <span className="font-medium">{REGISTER.device}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Operator</span>
                  <span className="font-medium">{REGISTER.operator}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Opened</span>
                  <span className="font-medium">{REGISTER.openedAt}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-muted-foreground">Opening float</span>
                  <span className="font-medium">{formatCentavos(REGISTER.float)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Session total</span>
                  <span className="font-semibold">{formatCentavos(REGISTER.sessionTotal)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Finalize sales with <kbd className="rounded border px-1">F12</kbd>. A print prompt will follow — confirm with
                  <kbd className="rounded border px-1">Y</kbd> or skip with <kbd className="rounded border px-1">N</kbd>.
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </Suspense>
      </div>
    </RequireFeature>
  );
}
