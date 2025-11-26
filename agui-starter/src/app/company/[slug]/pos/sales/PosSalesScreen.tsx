"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import type { SalesCartSnapshot, TenderInput } from "@/lib/pos/sales/types";
import { formatMoney, type CartUom, type PosCartLine, type PosCartState, usePosCart } from "@/lib/pos/sales-cart";
import type { WorkspaceSettings } from "@/lib/settings/workspace";

import { finalizeSaleAction, priceSaleLine, resolveSaleScan } from "./actions";
import {
  centsToInput,
  deriveCheckoutState,
  parseInputToCents,
  type TenderFormState,
} from "./checkout-helpers";

type Props = {
  slug: string;
  labels?: WorkspaceSettings["labels"];
  houseName: string;
};

function PosHeader({ houseName, labels }: { houseName: string; labels?: WorkspaceSettings["labels"] }) {
  const displayHouse = labels?.house ?? houseName;
  const displayPos = "POS";
  return (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{displayPos}</p>
        <h1 className="text-2xl font-semibold">{displayHouse} — Sales</h1>
      </div>
      <div className="text-right text-sm text-muted-foreground">
        <p>{new Date().toLocaleDateString()}</p>
        <p>{new Date().toLocaleTimeString()}</p>
      </div>
    </header>
  );
}

function PosTotals({ subtotal }: { subtotal: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="text-lg font-semibold">Totals</div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Discounts</span>
          <span>—</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Grand Total</span>
          <span className="text-lg font-semibold">{formatMoney(subtotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LineQuantityInput({
  line,
  onChange,
  disabled,
}: {
  line: PosCartLine;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={line.quantity}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-10"
      disabled={disabled}
    />
  );
}

function PosCartTable({
  lines,
  onQuantityChange,
  onUomChange,
  onRemove,
  isPending,
}: {
  lines: PosCartLine[];
  onQuantityChange: (line: PosCartLine, value: number) => void;
  onUomChange: (line: PosCartLine, uomId: string) => void;
  onRemove: (line: PosCartLine) => void;
  isPending: boolean;
}) {
  return (
    <div className="overflow-auto rounded-md border bg-card">
      <table className="w-full">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item</th>
            <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">UOM</th>
            <th className="w-[120px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
            <th className="w-[120px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit</th>
            <th className="w-[120px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subtotal</th>
            <th className="w-[60px]"></th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                Scan an item to begin.
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col">
                    <span className="font-semibold leading-tight">{line.itemName}</span>
                    <span className="text-xs text-muted-foreground">
                      {line.tierTag ? `Tier: ${line.tierTag}` : "Standard"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="h-10 w-full rounded-md border px-2"
                    value={line.uomId ?? undefined}
                    onChange={(event) => onUomChange(line, event.target.value)}
                    disabled={isPending}
                  >
                    {line.uoms.map((uom) => (
                      <option key={uom.id} value={uom.id}>
                        {uom.code}
                        {uom.label ? ` — ${uom.label}` : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <LineQuantityInput line={line} onChange={(value) => onQuantityChange(line, value)} disabled={isPending} />
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney(line.unitPrice)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney(line.lineTotal)}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" onClick={() => onRemove(line)} disabled={isPending}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PosScanBar({
  value,
  onChange,
  onSubmit,
  isPending,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isPending]);

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
          inputRef.current?.focus();
        }}
      >
        <div className="flex-1 space-y-1">
          <label htmlFor="scan" className="block text-sm font-medium text-muted-foreground">
            Scan or search
          </label>
          <Input
            id="scan"
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Scan barcode or type item code"
            autoFocus
            disabled={isPending}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="h-[42px] px-6">
            {isPending ? "Loading..." : "Add"}
          </Button>
        </div>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function PosCheckoutPanel({
  cartState,
  onConfirm,
  onResetCart,
  onRepeatLastLine,
  isCartPending,
}: {
  cartState: PosCartState;
  onConfirm: (input: {
    cart: SalesCartSnapshot;
    tenders: TenderInput[];
    customerId?: string | null;
    customerName?: string | null;
  }) => Promise<void>;
  onResetCart: () => void;
  onRepeatLastLine: () => void;
  isCartPending: boolean;
}) {
  const [form, setForm] = useState<TenderFormState>({
    cash: "",
    ewallet: "",
    credit: "",
    ewalletRef: "",
    customerId: "",
    customerName: "",
  });
  const [showRef, setShowRef] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerDraftName, setCustomerDraftName] = useState("");
  const [customerDraftId, setCustomerDraftId] = useState("");

  useEffect(() => {
    setForm((current) => {
      const hasCash = parseInputToCents(current.cash) > 0;
      if (hasCash) return current;
      return { ...current, cash: centsToInput(cartState.subtotal) };
    });
  }, [cartState.subtotal]);
  const checkoutState = useMemo(() => deriveCheckoutState(cartState, form), [cartState, form]);
  const {
    cartSnapshot,
    tenderInputs,
    previewTotals,
    requiresCustomer,
    hasCustomer,
    validationError,
    canConfirm,
    trimmedCustomer,
    trimmedCustomerId,
  } = checkoutState;
  const totalTendered = previewTotals.amountReceivedCents + previewTotals.sumCreditCents;

  const disabled = isSubmitting || isCartPending || !canConfirm;

  const resetForm = () => {
    setForm({
      cash: centsToInput(cartState.subtotal),
      ewallet: "",
      credit: "",
      ewalletRef: "",
      customerId: "",
      customerName: "",
    });
    setIsEditingCustomer(false);
  };

  const handleConfirm = () => {
    startSubmit(async () => {
      try {
        setError(null);
        await onConfirm({
          cart: cartSnapshot,
          tenders: tenderInputs,
          customerId: trimmedCustomerId || null,
          customerName: trimmedCustomer || null,
        });
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to finalize sale");
      }
    });
  };

  const openCustomerEditor = () => {
    setCustomerDraftName(form.customerName);
    setCustomerDraftId(form.customerId);
    setIsEditingCustomer(true);
  };

  const handleApplyCustomer = () => {
    setForm((current) => ({
      ...current,
      customerName: customerDraftName.trim(),
      customerId: customerDraftId.trim(),
    }));
    setIsEditingCustomer(false);
  };

  const handleClearCustomer = () => {
    setForm((current) => ({ ...current, customerName: "", customerId: "" }));
    setCustomerDraftId("");
    setCustomerDraftName("");
    setIsEditingCustomer(false);
  };

  const customerLabel = form.customerName || form.customerId ? `Customer: ${form.customerName || form.customerId}` : "Walk-in customer";
  const customerBarClass = requiresCustomer && !hasCustomer ? "border-destructive" : "border-border";

  return (
    <Card>
      <CardHeader>
        <div className="text-lg font-semibold">Checkout</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`space-y-2 rounded-md border ${customerBarClass} bg-muted/40 p-3`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
              <p className="text-sm font-semibold text-foreground">{customerLabel}</p>
              {requiresCustomer && !hasCustomer ? (
                <p className="text-xs text-destructive">Select a customer to use credit.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={openCustomerEditor} type="button">
                Set customer
              </Button>
              {hasCustomer ? (
                <Button size="sm" variant="ghost" onClick={handleClearCustomer} type="button">
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {isEditingCustomer ? (
            <div className="space-y-2 rounded-md border border-border bg-card/60 p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="customer-name">
                  Customer name
                </label>
                <Input
                  id="customer-name"
                  value={customerDraftName}
                  onChange={(event) => setCustomerDraftName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                  aria-label="Customer name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="customer-id">
                  Existing customer ID (optional)
                </label>
                <Input
                  id="customer-id"
                  value={customerDraftId}
                  onChange={(event) => setCustomerDraftId(event.target.value)}
                  placeholder="entity-123"
                  aria-label="Customer identifier"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditingCustomer(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="button" onClick={handleApplyCustomer}>
                  Apply
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatMoney(cartSnapshot.subtotalCents)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Discount</span>
            <span>—</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>{formatMoney(cartSnapshot.subtotalCents)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Cash</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              aria-label="Cash amount"
              value={form.cash}
              onChange={(event) => setForm((current) => ({ ...current, cash: event.target.value }))}
              className="h-10 w-40 text-right"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm">E-wallet / Bank</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-label="E-wallet amount"
                value={form.ewallet}
                onChange={(event) => setForm((current) => ({ ...current, ewallet: event.target.value }))}
                className="h-10 w-40 text-right"
              />
            </div>
            {showRef || form.ewalletRef ? (
              <Input
                placeholder="Reference (optional)"
                aria-label="E-wallet reference"
                value={form.ewalletRef}
                onChange={(event) => setForm((current) => ({ ...current, ewalletRef: event.target.value }))}
                className="h-9"
              />
            ) : (
              <button type="button" className="text-xs text-primary underline" onClick={() => setShowRef(true)}>
                Add reference
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Credit / Utang</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              aria-label="Credit amount"
              value={form.credit}
              onChange={(event) => setForm((current) => ({ ...current, credit: event.target.value }))}
              className="h-10 w-40 text-right"
            />
          </div>
        </div>

        <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total tendered</span>
            <span className="font-semibold">{formatMoney(totalTendered)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Change</span>
            <span className="font-semibold">{formatMoney(previewTotals.changeCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Outstanding</span>
            <span className="font-semibold">{formatMoney(previewTotals.outstandingCents)}</span>
          </div>
        </div>

        {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-2">
          <Button className="w-full" disabled={disabled} onClick={handleConfirm}>
            {isSubmitting ? "Confirming..." : "Confirm sale"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="w-1/2" onClick={onRepeatLastLine} disabled={isCartPending}>
              Repeat last line
            </Button>
            <Button variant="outline" className="w-1/2" onClick={onResetCart} disabled={isCartPending}>
              Clear cart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PosSalesScreen({ slug, labels, houseName }: Props) {
  const { state, addOrUpdateLine, updateQuantity, changeUom, removeLine, repeatLastLine, resetCart } = usePosCart();
  const [scanValue, setScanValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const parseScan = useMemo(() => {
    const regex = /^(\d+)\*(.+)$/;
    return (input: string) => {
      const match = input.match(regex);
      if (match) {
        return { quantity: Number(match[1]), code: match[2] ?? "" };
      }
      return { quantity: 1, code: input };
    };
  }, []);

  const handleLookup = (code: string, quantity: number) => {
    startTransition(async () => {
      try {
        setError(null);
        const resolved = await resolveSaleScan(slug, { code, quantity });
        const targetUom = resolved.uoms.find((entry: CartUom) => entry.id === resolved.uomId) ?? resolved.uoms[0];
        const existing = state.lines.find(
          (line) => line.itemId === resolved.item.id && line.uomId === (targetUom?.id ?? null),
        );
        const nextQuantity = (existing?.quantity ?? 0) + resolved.quantity;
        const priced = await priceSaleLine(slug, {
          itemId: resolved.item.id,
          uomId: targetUom?.id ?? null,
          quantity: nextQuantity,
        });

        addOrUpdateLine({
          itemId: resolved.item.id,
          itemName: resolved.item.name,
          barcode: resolved.barcode,
          quantity: nextQuantity,
          unitPrice: priced.unitPrice,
          tierTag: priced.tierTag,
          uomId: targetUom?.id ?? null,
          uomCode: targetUom?.code ?? "",
          uomLabel: targetUom?.label ?? null,
          uoms: resolved.uoms,
        });

        setScanValue("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to find item");
      }
    });
  };

  const handleSubmit = () => {
    const trimmed = scanValue.trim();
    if (!trimmed) return;
    const parsed = parseScan(trimmed);
    handleLookup(parsed.code, parsed.quantity);
  };

  const handleQuantityChange = (line: PosCartLine, next: number) => {
    startTransition(async () => {
      try {
        const price = await priceSaleLine(slug, { itemId: line.itemId, uomId: line.uomId, quantity: next });
        updateQuantity(line.id, next, price);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update quantity");
      }
    });
  };

  const handleUomChange = (line: PosCartLine, uomId: string) => {
    const uom = line.uoms.find((entry) => entry.id === uomId);
    if (!uom) return;
    startTransition(async () => {
      try {
        const price = await priceSaleLine(slug, { itemId: line.itemId, uomId: uom.id, quantity: line.quantity });
        changeUom(line.id, uom as CartUom, price);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to change UOM");
      }
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey && event.key.toLowerCase() === "r") || event.key === "Insert") {
        event.preventDefault();
        repeatLastLine();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [repeatLastLine]);

  const handleConfirmSale = async (payload: {
    cart: SalesCartSnapshot;
    tenders: TenderInput[];
    customerId?: string | null;
    customerName?: string | null;
  }) => {
    const summary = await finalizeSaleAction(slug, payload);
    toast.success(`Sale completed. Change: ${formatMoney(summary.changeCents)}`);
    resetCart();
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-50 p-4">
      <PosHeader houseName={houseName} labels={labels} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <PosScanBar value={scanValue} onChange={setScanValue} onSubmit={handleSubmit} isPending={isPending} error={error} />
          <PosCartTable
            lines={state.lines}
            onQuantityChange={handleQuantityChange}
            onUomChange={handleUomChange}
            onRemove={(line) => removeLine(line.id)}
            isPending={isPending}
          />
        </div>
        <div className="w-full space-y-3 lg:w-96">
          <PosTotals subtotal={state.subtotal} />
          <PosCheckoutPanel
            cartState={state}
            onConfirm={handleConfirmSale}
            onResetCart={resetCart}
            onRepeatLastLine={repeatLastLine}
            isCartPending={isPending}
          />
        </div>
      </div>
    </div>
  );
}
