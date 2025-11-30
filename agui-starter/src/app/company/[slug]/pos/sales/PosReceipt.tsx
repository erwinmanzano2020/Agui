"use client";

import { formatMoney } from "@/lib/pos/sales-cart";
import type { PosReceiptSale } from "@/lib/pos/sales/types";
import type { WorkspaceSettings } from "@/lib/settings/workspace";

type Props = {
  sale: PosReceiptSale;
  labels?: WorkspaceSettings["labels"];
  houseName: string;
};

function ReceiptHeader({ sale, houseName, labels }: Props) {
  const business = labels?.house ?? houseName;
  const branch = labels?.branch ?? null;
  const created = new Date(sale.createdAt);
  return (
    <div className="text-center">
      <h2 className="text-lg font-semibold">{business}</h2>
      {branch ? <p className="text-sm text-muted-foreground">{branch}</p> : null}
      <p className="text-xs text-muted-foreground">TIN / Address to follow</p>
      <div className="mt-2 text-left text-xs">
        <div className="flex justify-between">
          <span className="font-semibold">Receipt #</span>
          <span>{sale.receiptNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Date</span>
          <span>
            {created.toLocaleDateString()} {created.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PosReceipt({ sale, houseName, labels }: Props) {
  const discount = sale.discountCents ?? 0;
  const totalDue = sale.totalCents;
  return (
    <div className="receipt-print space-y-3 rounded-md border bg-card p-4">
      <ReceiptHeader sale={sale} houseName={houseName} labels={labels} />

      {sale.customerName || sale.customerId ? (
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <div className="font-semibold">Customer</div>
          <div>{sale.customerName ?? sale.customerId}</div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border text-xs">
        <div className="grid grid-cols-6 bg-muted/50 px-2 py-1 font-semibold">
          <span className="col-span-3">Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit</span>
          <span className="text-right">Total</span>
        </div>
        <div className="divide-y">
          {sale.lines.map((line, index) => (
            <div key={`${line.name}-${index}`} className="grid grid-cols-6 px-2 py-1">
              <div className="col-span-3">
                <div className="font-medium">{line.name}</div>
                <div className="text-[11px] text-muted-foreground">{line.uomLabel ?? ""}</div>
                {line.savingsPerUnitCents ? (
                  <div className="text-[11px] text-emerald-700">Save {formatMoney(line.savingsPerUnitCents)} / unit</div>
                ) : null}
              </div>
              <div className="text-right">{line.quantity}</div>
              <div className="text-right">{formatMoney(line.unitPriceCents)}</div>
              <div className="text-right font-semibold">{formatMoney(line.lineTotalCents)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatMoney(sale.subtotalCents)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span className="font-semibold">{discount > 0 ? formatMoney(discount) : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-semibold">{formatMoney(totalDue)}</span>
        </div>
        <p className="text-xs text-muted-foreground">VAT status: VAT included / N/A</p>
      </div>

      <div className="rounded-md bg-muted/40 p-3 text-sm">
        <div className="font-semibold">Tenders</div>
        <div className="mt-1 space-y-1">
          {sale.tenders.map((tender, idx) => (
            <div key={`${tender.label}-${idx}`} className="flex justify-between">
              <span>{tender.label}</span>
              <span>{formatMoney(tender.amountCents)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Change</span>
            <span className="font-semibold text-foreground">{formatMoney(sale.changeCents)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Outstanding</span>
            <span className="font-semibold text-foreground">{formatMoney(sale.outstandingCents)}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          .receipt-print {
            width: 320px;
            border: none;
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
