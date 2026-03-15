import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { RequireFeature } from "@/components/auth/RequireFeature";
import { AppFeature } from "@/lib/auth/permissions";
import { computeReturn } from "@/lib/pos/returns";
import {
  aggregateManifest,
  computeSplit,
  type NormalizedTenderLine,
  type TenderLine,
  validateTenderLines,
} from "@/lib/pos/tenders";
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

const PAYMENT_TENDERS: TenderLine[] = [
  { type: "CASH", amount: 2500, metadata: { change: 0 } },
  { type: "GCASH", amount: 2500, metadata: { reference: "GC-554482" } },
  { type: "MAYA", amount: 1500, metadata: { reference: "MY-884120" } },
  {
    type: "CHECK",
    amount: 1200,
    metadata: {
      bankName: "Metrobank",
      checkNumber: "CHK-7781",
      checkDate: "2025-03-08T00:00:00.000Z",
      note: "Deposit within 3 days",
    },
  },
  {
    type: "BANK_TRANSFER",
    amount: 1000,
    metadata: {
      bankName: "BPI",
      reference: "TR-99021",
      transferDate: "2025-03-09T00:00:00.000Z",
    },
  },
  {
    type: "LOYALTY",
    amount: 1000,
    metadata: { pointsRedeemed: 10, conversionRate: 100, remainingPoints: 90 },
  },
];

const PAYMENT_HINTS: string[] = [
  "Cash overages automatically compute change and highlight the drawer delta.",
  "GCash and Maya tenders capture the reference ID for reconciliation and QR display.",
  "Checks log bank, number, and date so the deposit register stays aligned.",
  "Bank transfers track the clearing date to reconcile the manifest.",
  "Loyalty redemption shows points redeemed and remaining balance after checkout.",
];

const SPLIT_PARTICIPANTS = [
  { id: "bea", label: "Bea" },
  { id: "ced", label: "Ced" },
  { id: "migs", label: "Migs" },
];

const RETURN_SALE_LINES = [
  {
    id: "beans",
    quantity: 1,
    unitPrice: 3000,
    lineTotal: 3000,
    description: "Single-origin beans 500g",
  },
  { id: "mug", quantity: 1, unitPrice: 2000, lineTotal: 2000, description: "Stoneware mug" },
  { id: "topup", quantity: 1, unitPrice: 3000, lineTotal: 3000, description: "Gift card top-up" },
];

const RETURN_SALE_TOTAL = RETURN_SALE_LINES.reduce((acc, line) => acc + line.lineTotal, 0);

const RETURN_SALE_TENDER_INPUT: TenderLine[] = [
  { type: "CASH", amount: 3000 },
  { type: "MAYA", amount: 2500, metadata: { reference: "MY-4411" } },
  {
    type: "LOYALTY",
    amount: 2500,
    metadata: { pointsRedeemed: 25, conversionRate: 100, remainingPoints: 75 },
  },
];

const RETURN_SALE_TENDERS: NormalizedTenderLine[] = validateTenderLines({
  amountDue: RETURN_SALE_TOTAL,
  allowChange: false,
  loyaltyBalance: 150,
  tenders: RETURN_SALE_TENDER_INPUT,
}).normalizedTenders;

const RETURN_SALE = {
  saleId: "SALE-4821",
  lines: RETURN_SALE_LINES,
  tenders: RETURN_SALE_TENDERS,
};

const RETURN_SAMPLE_PREVIEW = computeReturn({
  sale: RETURN_SALE,
  selections: [
    { lineId: "mug", quantity: 1, reason: "Wrong size" },
    { lineId: "beans", quantity: 1, reason: "Flavor swap" },
  ],
  exchangeAmount: 1500,
  loyaltyConversionRate: 100,
});

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
  const paymentPreview = validateTenderLines({
    amountDue: cartTotals.total,
    allowChange: true,
    loyaltyBalance: 120,
    tenders: PAYMENT_TENDERS,
  });
  const manifestSummary = aggregateManifest(paymentPreview.normalizedTenders);
  const equalSplit = computeSplit({ amountDue: cartTotals.total, participants: SPLIT_PARTICIPANTS });
  const customSplit = computeSplit({
    amountDue: cartTotals.total,
    participants: SPLIT_PARTICIPANTS,
    shares: [
      { participantId: "bea", amount: 2950 },
      { participantId: "ced", amount: 3500 },
      { participantId: "migs", amount: cartTotals.total - 2950 - 3500 },
    ],
  });

  const participantMap = new Map(
    SPLIT_PARTICIPANTS.map((participant) => [participant.id, participant.label] as const),
  );
  const changeDue = paymentPreview.changeDue;

  const renderTenderMetadata = (tender: NormalizedTenderLine) => {
    switch (tender.type) {
      case "CASH": {
        const metadata = tender.metadata as { change?: number | null } | null;
        return metadata?.change ? `Change ${formatCentavos(metadata.change)}` : "Cash drawer";
      }
      case "GCASH":
      case "MAYA": {
        const metadata = tender.metadata as { reference?: string | null } | null;
        return metadata?.reference ? `Ref ${metadata.reference}` : "QR tender";
      }
      case "CHECK": {
        const metadata = tender.metadata as {
          bankName?: string;
          checkNumber?: string;
          checkDate?: string;
        } | null;
        const date = metadata?.checkDate ? new Date(metadata.checkDate) : null;
        return metadata
          ? `${metadata.bankName} · ${metadata.checkNumber} · ${date ? date.toLocaleDateString() : "dated"}`
          : "Check received";
      }
      case "BANK_TRANSFER": {
        const metadata = tender.metadata as {
          bankName?: string;
          reference?: string;
          transferDate?: string;
        } | null;
        const date = metadata?.transferDate ? new Date(metadata.transferDate) : null;
        return metadata
          ? `${metadata.bankName} · ${metadata.reference} · ${date ? date.toLocaleDateString() : "transfer"}`
          : "Bank transfer";
      }
      case "LOYALTY": {
        const metadata = tender.metadata as {
          pointsRedeemed?: number;
          remainingPoints?: number | null;
        } | null;
        if (!metadata) return "Loyalty";
        return `Redeemed ${metadata.pointsRedeemed} pts · Remaining ${metadata.remainingPoints ?? "—"}`;
      }
      default:
        return "Tender";
    }
  };

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
            <Card className="border border-dashed border-border/70">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payments</div>
                  <div className="text-lg font-semibold">Captured tenders</div>
                </div>
                <Badge tone="on">PAID</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {paymentPreview.normalizedTenders.map((tender, index) => (
                    <div
                      key={`${tender.type}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{tender.type}</div>
                        <div className="text-xs text-muted-foreground">{renderTenderMetadata(tender)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatCentavos(tender.amount)}</div>
                        {tender.type === "CASH" && changeDue > 0 ? (
                          <div className="text-xs text-muted-foreground">Change {formatCentavos(changeDue)}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-card/50 p-3 text-xs text-muted-foreground">
                  <div className="text-sm font-semibold text-foreground">Tender reminders</div>
                  <ul className="space-y-1 list-inside list-disc">
                    {PAYMENT_HINTS.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount due</span>
                  <span className="font-medium">{formatCentavos(paymentPreview.amountDue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total tendered</span>
                  <span className="font-semibold">{formatCentavos(paymentPreview.totalTendered)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Change due</span>
                  <span className="font-medium">{changeDue > 0 ? formatCentavos(changeDue) : "—"}</span>
                </div>
                {paymentPreview.loyalty ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Loyalty redeemed</span>
                    <span className="font-medium">
                      {paymentPreview.loyalty.pointsRedeemed} pts · remaining {paymentPreview.loyalty.remainingPoints ?? "—"}
                    </span>
                  </div>
                ) : null}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Split bill</div>
                  <div className="text-lg font-semibold">Equal & custom shares</div>
                </div>
                <Badge tone="off">SPLIT</Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Equal split</div>
                  <div className="mt-2 space-y-2">
                    {equalSplit.shares.map((share) => (
                      <div
                        key={`equal-${share.participantId}`}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2"
                      >
                        <span className="font-medium text-foreground">{participantMap.get(share.participantId)}</span>
                        <span className="font-semibold">{formatCentavos(share.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Custom share</div>
                  <div className="mt-2 space-y-2">
                    {customSplit.shares.map((share) => (
                      <div
                        key={`custom-${share.participantId}`}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-card/70 px-3 py-2"
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{participantMap.get(share.participantId)}</div>
                          <div className="text-xs text-muted-foreground">QR link auto-generates for e-wallets.</div>
                        </div>
                        <span className="font-semibold">{formatCentavos(share.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Split payloads feed directly into the checkout API so each tender line is persisted per guest.
                </p>
              </CardFooter>
            </Card>

            <Card className="border border-dashed border-border/70">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Returns & refunds</div>
                  <div className="text-lg font-semibold">Supervisor flow</div>
                </div>
                <Badge tone="off">RETURN</Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  {RETURN_SAMPLE_PREVIEW.lineAdjustments.map((line) => (
                    <div
                      key={line.lineId}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2"
                    >
                      <div>
                        <div className="font-medium text-foreground">Line {line.lineId}</div>
                        <div className="text-xs text-muted-foreground">Qty {line.quantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCentavos(line.value)}</div>
                        {line.reason ? (
                          <div className="text-xs text-muted-foreground">{line.reason}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 rounded-lg border border-border/50 bg-card/70 p-3 text-xs">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Refund due</span>
                    <span>{formatCentavos(RETURN_SAMPLE_PREVIEW.refundDue)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-muted-foreground">
                    {RETURN_SAMPLE_PREVIEW.tenderReversals.map((reversal) => (
                      <span
                        key={`reversal-${reversal.type}`}
                        className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground"
                      >
                        {reversal.type}: {formatCentavos(reversal.amount)}
                      </span>
                    ))}
                  </div>
                  {RETURN_SAMPLE_PREVIEW.loyalty ? (
                    <div className="text-muted-foreground">
                      Restore {RETURN_SAMPLE_PREVIEW.loyalty.pointsToRestore} loyalty pts (value {formatCentavos(
                        RETURN_SAMPLE_PREVIEW.loyalty.value,
                      )}).
                    </div>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Supervisor approval captures a PIN/QR token before reversing ledgers and emitting sale:return / sale:refund.
                </p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shift manifest</div>
                <div className="text-lg font-semibold">Non-cash recap</div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cash variance scope</span>
                  <span className="font-medium">{formatCentavos(manifestSummary.cash.total)}</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(manifestSummary.ewallets).map(([provider, info]) => (
                    <div key={provider} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{provider}</span>
                      <span className="font-medium">{formatCentavos(info.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Checks</span>
                  <span className="font-medium">{formatCentavos(manifestSummary.checks.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bank transfers</span>
                  <span className="font-medium">{formatCentavos(manifestSummary.bankTransfers.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Loyalty value</span>
                  <span className="font-medium">{formatCentavos(manifestSummary.loyalty.value)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Non-cash tenders roll into the manifest for information-only reconciliation while cash variance stays isolated.
                </p>
              </CardContent>
            </Card>

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
