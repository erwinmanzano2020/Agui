"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import type { PosReceiptSale, RecentSaleSummary, SalesCartSnapshot, TenderInput } from "@/lib/pos/sales/types";
import { formatMoney, type CartUom, type PosCartLine, usePosCart } from "@/lib/pos/sales-cart";
import type { WorkspaceSettings } from "@/lib/settings/workspace";

import {
  closeShiftAction,
  finalizeSaleAction,
  listRecentSalesAction,
  loadActiveShiftAction,
  loadSaleReceiptAction,
  loadShiftSummaryAction,
  openShiftAction,
  priceSaleLine,
  resolveSaleScan,
} from "./actions";
import {
  centsToInput,
  deriveCheckoutState,
  parseInputToCents,
  type TenderFormState,
} from "./checkout-helpers";
import { PosReceipt } from "./PosReceipt";

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

function PosTotals({ subtotal, discount, total }: { subtotal: number; discount: number; total: number }) {
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
          <span>{discount > 0 ? formatMoney(discount) : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Grand Total</span>
          <span className="text-lg font-semibold">{formatMoney(total)}</span>
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
                    {line.baseUnitPrice > line.unitPrice ? (
                      <span className="text-xs text-emerald-700">
                        You save {formatMoney(line.baseUnitPrice - line.unitPrice)} per unit
                      </span>
                    ) : null}
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
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
  disabled?: boolean;
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
            disabled={isPending || disabled}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending || disabled} className="h-[42px] px-6">
            {isPending ? "Loading..." : "Add"}
          </Button>
        </div>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function RecentSalesPanel({
  sales,
  isLoading,
  onRefresh,
  onSelect,
  selectedId,
  error,
}: {
  sales: RecentSaleSummary[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  error?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Recent sales</div>
          <p className="text-xs text-muted-foreground">Last 50 receipts</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {sales.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No recent sales found.</p>
        ) : null}
        <div className="space-y-2">
          {sales.map((sale) => {
            const isActive = selectedId === sale.id;
            return (
              <button
                key={sale.id}
                type="button"
                onClick={() => onSelect(sale.id)}
                className={`w-full rounded-md border px-3 py-2 text-left transition ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{sale.receiptNumber ?? sale.id}</span>
                  <span>{formatMoney(sale.totalCents)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(sale.createdAt).toLocaleString()} • {sale.tenderSummary}
                </div>
                {sale.customerName ? <div className="text-xs">{sale.customerName}</div> : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function PosCheckoutPanel({
  form,
  setForm,
  onConfirm,
  onResetCart,
  onRepeatLastLine,
  isCartPending,
  checkoutState,
  activeShift,
  shiftError,
  isShiftLoading,
}: {
  form: TenderFormState;
  setForm: Dispatch<SetStateAction<TenderFormState>>;
  onConfirm: (input: {
    cart: SalesCartSnapshot;
    tenders: TenderInput[];
    customerId?: string | null;
    customerName?: string | null;
  }) => Promise<void>;
  onResetCart: () => void;
  onRepeatLastLine: () => void;
  isCartPending: boolean;
  checkoutState: ReturnType<typeof deriveCheckoutState>;
  activeShift: Awaited<ReturnType<typeof loadActiveShiftAction>>;
  shiftError?: string | null;
  isShiftLoading?: boolean;
}) {
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
      const totalDue = Math.max(0, checkoutState.cartSnapshot.subtotalCents - (checkoutState.cartSnapshot.discountCents ?? 0));
      return { ...current, cash: centsToInput(totalDue) };
    });
  }, [checkoutState.cartSnapshot.discountCents, checkoutState.cartSnapshot.subtotalCents, setForm]);
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
  const discountValue = cartSnapshot.discountCents ?? 0;
  const totalDue = Math.max(0, cartSnapshot.subtotalCents - discountValue);

  const disabled = isSubmitting || isCartPending || !canConfirm || !activeShift || isShiftLoading;

  const resetForm = () => {
    const totalDue = Math.max(0, checkoutState.cartSnapshot.subtotalCents - (checkoutState.cartSnapshot.discountCents ?? 0));
    setForm({
      cash: centsToInput(totalDue),
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
            <span>{discountValue > 0 ? formatMoney(discountValue) : "—"}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>{formatMoney(totalDue)}</span>
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
        {shiftError ? <p className="text-sm text-destructive">{shiftError}</p> : null}
        {!activeShift ? (
          <p className="text-sm text-destructive">Open a shift before recording sales.</p>
        ) : null}
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
  const [form, setForm] = useState<TenderFormState>({
    cash: "",
    ewallet: "",
    credit: "",
    ewalletRef: "",
    customerId: "",
    customerName: "",
  });
  const [scanValue, setScanValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<"checkout" | "receipt" | "history">("checkout");
  const [activeReceipt, setActiveReceipt] = useState<PosReceiptSale | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSaleSummary[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const [isReceiptLoading, startReceiptTransition] = useTransition();
  const [activeShift, setActiveShift] = useState<Awaited<ReturnType<typeof loadActiveShiftAction>>>(null);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [openingCashInput, setOpeningCashInput] = useState("0.00");
  const [countedCashInput, setCountedCashInput] = useState("0.00");
  const [closePreview, setClosePreview] = useState<Awaited<ReturnType<typeof loadShiftSummaryAction>> | null>(null);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [isShiftPending, startShiftTransition] = useTransition();
  const toast = useToast();

  const checkoutState = useMemo(() => deriveCheckoutState(state, form), [state, form]);
  const checkoutTotal = Math.max(0, checkoutState.cartSnapshot.subtotalCents - (checkoutState.cartSnapshot.discountCents ?? 0));
  const isCheckoutMode = panelView === "checkout";
  const expectedDrawer = closePreview?.expectedCashCents ?? activeShift?.expectedCashCents ?? 0;
  const countedPreview = parseInputToCents(countedCashInput);
  const variance = countedPreview - expectedDrawer;
  const varianceLabel = variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short";
  const changeFromSales = closePreview
    ? closePreview.totalCashTenderCents + closePreview.shift.openingCashCents - closePreview.expectedCashCents
    : null;

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

  const resetFormFields = useCallback(() => {
    setForm({
      cash: "",
      ewallet: "",
      credit: "",
      ewalletRef: "",
      customerId: "",
      customerName: "",
    });
  }, []);

  const handleNewSale = useCallback(() => {
    resetCart();
    resetFormFields();
    setScanValue("");
    setError(null);
    setActiveReceipt(null);
    setSelectedHistoryId(null);
    setPanelView("checkout");
  }, [resetCart, resetFormFields]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const refreshShift = useCallback(() => {
    startShiftTransition(async () => {
      try {
        const shift = await loadActiveShiftAction(slug);
        setActiveShift(shift);
        if (shift) {
          setOpeningCashInput(centsToInput(shift.openingCashCents));
          setCountedCashInput(centsToInput(shift.expectedCashCents));
        }
        setShiftError(null);
      } catch (err) {
        setShiftError(err instanceof Error ? err.message : "Unable to load shift");
      }
    });
  }, [slug]);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  const handleOpenShift = useCallback(() => {
    startShiftTransition(async () => {
      try {
        setShiftError(null);
        const openingCashCents = parseInputToCents(openingCashInput);
        const shift = await openShiftAction(slug, { openingCashCents });
        setActiveShift(shift);
        setClosePreview(null);
        setIsClosingShift(false);
        toast.success("Shift opened");
      } catch (err) {
        setShiftError(err instanceof Error ? err.message : "Unable to open shift");
      }
    });
  }, [openingCashInput, slug, toast]);

  const handleStartCloseShift = useCallback(() => {
    if (!activeShift) return;
    setIsClosingShift(true);
    startShiftTransition(async () => {
      try {
        const summary = await loadShiftSummaryAction(slug, activeShift.id);
        setClosePreview(summary);
        setCountedCashInput(centsToInput(summary.expectedCashCents));
        setShiftError(null);
      } catch (err) {
        setShiftError(err instanceof Error ? err.message : "Unable to load shift totals");
        setIsClosingShift(false);
      }
    });
  }, [activeShift, slug]);

  const handleConfirmCloseShift = useCallback(() => {
    if (!activeShift) return;
    startShiftTransition(async () => {
      try {
        const countedCashCents = parseInputToCents(countedCashInput);
        const summary = await closeShiftAction(slug, { shiftId: activeShift.id, countedCashCents });
        setClosePreview(summary);
        setActiveShift(null);
        setIsClosingShift(false);
        toast.success("Shift closed");
      } catch (err) {
        setShiftError(err instanceof Error ? err.message : "Unable to close shift");
      }
    });
  }, [activeShift, countedCashInput, slug, toast]);

  const handleCancelCloseShift = useCallback(() => {
    setIsClosingShift(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCheckoutMode) return;
      if ((event.ctrlKey && event.key.toLowerCase() === "r") || event.key === "Insert") {
        event.preventDefault();
        repeatLastLine();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [repeatLastLine, isCheckoutMode]);

  useEffect(() => {
    if (panelView !== "receipt") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleNewSale();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewSale, handlePrint, panelView]);

  const handleLookup = (code: string, quantity: number) => {
    if (!isCheckoutMode) return;
    startTransition(async () => {
      try {
        setError(null);
        const resolved = await resolveSaleScan(slug, { code, quantity, customerId: form.customerId });
        const targetUom = resolved.uoms.find((entry: CartUom) => entry.id === resolved.uomId) ?? resolved.uoms[0];
        const existing = state.lines.find(
          (line) => line.itemId === resolved.item.id && line.uomId === (targetUom?.id ?? null),
        );
        const nextQuantity = (existing?.quantity ?? 0) + resolved.quantity;
        const priced = await priceSaleLine(slug, {
          itemId: resolved.item.id,
          uomId: targetUom?.id ?? null,
          quantity: nextQuantity,
          customerId: form.customerId,
        });

        addOrUpdateLine({
          itemId: resolved.item.id,
          itemName: resolved.item.name,
          barcode: resolved.barcode,
          quantity: nextQuantity,
          unitPrice: priced.unitPrice,
          baseUnitPrice: priced.baseUnitPrice,
          tierTag: priced.tierTag,
          uomId: targetUom?.id ?? null,
          uomCode: targetUom?.code ?? "",
          uomLabel: targetUom?.label ?? null,
          specialPricing: priced.specialPricing ?? resolved.specialPricing ?? null,
          uoms: resolved.uoms,
        });

        setScanValue("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to find item");
      }
    });
  };

  const handleSubmit = () => {
    if (!isCheckoutMode) return;
    const trimmed = scanValue.trim();
    if (!trimmed) return;
    const parsed = parseScan(trimmed);
    handleLookup(parsed.code, parsed.quantity);
  };

  const handleQuantityChange = (line: PosCartLine, next: number) => {
    if (!isCheckoutMode) return;
    startTransition(async () => {
      try {
        const price = await priceSaleLine(slug, {
          itemId: line.itemId,
          uomId: line.uomId,
          quantity: next,
          customerId: form.customerId,
        });
        updateQuantity(line.id, next, price);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update quantity");
      }
    });
  };

  const handleUomChange = (line: PosCartLine, uomId: string) => {
    if (!isCheckoutMode) return;
    const uom = line.uoms.find((entry) => entry.id === uomId);
    if (!uom) return;
    startTransition(async () => {
      try {
        const price = await priceSaleLine(slug, {
          itemId: line.itemId,
          uomId: uom.id,
          quantity: line.quantity,
          customerId: form.customerId,
        });
        changeUom(line.id, uom as CartUom, price);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to change UOM");
      }
    });
  };

  const handleConfirmSale = async (payload: {
    cart: SalesCartSnapshot;
    tenders: TenderInput[];
    customerId?: string | null;
    customerName?: string | null;
  }) => {
    if (!activeShift) {
      setError("Open a shift before recording sales.");
      return;
    }
    const summary = await finalizeSaleAction(slug, payload);
    toast.success(`Sale completed. Change: ${formatMoney(summary.changeCents)}`);
    setActiveReceipt(summary);
    setSelectedHistoryId(summary.id);
    setPanelView("receipt");
    resetCart();
  };

  const refreshHistory = useCallback(() => {
    startHistoryTransition(async () => {
      try {
        setHistoryError(null);
        const items = await listRecentSalesAction(slug, 50);
        setRecentSales(items);
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : "Unable to load history");
      }
    });
  }, [slug]);

  const handleShowHistory = () => {
    setPanelView("history");
    refreshHistory();
  };

  const handleSelectHistorySale = (saleId: string) => {
    setSelectedHistoryId(saleId);
    startReceiptTransition(async () => {
      try {
        setHistoryError(null);
        const result = await loadSaleReceiptAction(slug, saleId);
        if (result.ok) {
          setActiveReceipt(result.sale);
          setPanelView("receipt");
        } else {
          setActiveReceipt(null);
          setHistoryError("Receipt not found");
        }
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : "Unable to load receipt");
      }
    });
  };

  let rightContent: ReactNode;
  if (panelView === "receipt" && activeReceipt) {
    rightContent = (
      <div className="space-y-3">
        <PosReceipt sale={activeReceipt} houseName={houseName} labels={labels} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint}>
            Print
          </Button>
          <Button variant="outline" onClick={handleShowHistory}>
            Recent sales
          </Button>
          <Button onClick={handleNewSale}>New sale</Button>
        </div>
      </div>
    );
  } else if (panelView === "history") {
    rightContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPanelView("checkout")}>Back to checkout</Button>
          <Button variant="outline" onClick={handleNewSale}>New sale</Button>
        </div>
        <RecentSalesPanel
          sales={recentSales}
          isLoading={isHistoryPending}
          onRefresh={refreshHistory}
          onSelect={handleSelectHistorySale}
          selectedId={selectedHistoryId}
          error={historyError}
        />
        {isReceiptLoading ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">Loading receipt...</CardContent>
          </Card>
        ) : activeReceipt ? (
          <PosReceipt sale={activeReceipt} houseName={houseName} labels={labels} />
        ) : null}
      </div>
    );
  } else {
    rightContent = (
      <>
        <PosTotals
          subtotal={checkoutState.cartSnapshot.subtotalCents}
          discount={checkoutState.cartSnapshot.discountCents ?? 0}
          total={checkoutTotal}
        />
        <PosCheckoutPanel
          form={form}
          setForm={setForm}
          onConfirm={handleConfirmSale}
          onResetCart={resetCart}
          onRepeatLastLine={repeatLastLine}
          isCartPending={isPending}
          checkoutState={checkoutState}
          activeShift={activeShift}
          shiftError={shiftError}
          isShiftLoading={isShiftPending}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 bg-slate-50 p-4">
      <PosHeader houseName={houseName} labels={labels} />
      <div className="rounded-md border bg-white p-4 shadow-sm">
        {activeShift ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active shift</p>
              <p className="font-semibold">Shift #{activeShift.id}</p>
              <p className="text-sm text-muted-foreground">
                Opened {new Date(activeShift.openedAt).toLocaleString()} • Opening {formatMoney(activeShift.openingCashCents)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={refreshShift} disabled={isShiftPending}>
                Refresh
              </Button>
              <Button onClick={handleStartCloseShift} disabled={isShiftPending}>
                Close shift
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-destructive">No active shift</p>
              <p className="text-sm text-muted-foreground">Enter opening cash to start a shift.</p>
              {shiftError ? <p className="text-xs text-destructive">{shiftError}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-32"
                value={openingCashInput}
                onChange={(event) => setOpeningCashInput(event.target.value)}
                aria-label="Opening cash"
              />
              <Button onClick={handleOpenShift} disabled={isShiftPending}>
                {isShiftPending ? "Opening..." : "Open shift"}
              </Button>
            </div>
          </div>
        )}

        {isClosingShift ? (
          <div className="mt-3 space-y-3 rounded-md border border-dashed bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Close shift</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancelCloseShift} disabled={isShiftPending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmCloseShift}
                  disabled={isShiftPending || !closePreview || !activeShift}
                >
                  {isShiftPending ? "Saving..." : "Confirm close"}
                </Button>
              </div>
            </div>
            {closePreview ? (
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Opening cash</span>
                  <span className="font-semibold">{formatMoney(closePreview.shift.openingCashCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sales total</span>
                  <span className="font-semibold">{formatMoney(closePreview.totalSalesCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cash tendered</span>
                  <span className="font-semibold">{formatMoney(closePreview.totalCashTenderCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Change given</span>
                  <span className="font-semibold">{formatMoney(Math.max(0, changeFromSales ?? 0))}</span>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="counted-cash-input">
                    Counted cash in drawer
                  </label>
                  <Input
                    id="counted-cash-input"
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full"
                    value={countedCashInput}
                    onChange={(event) => setCountedCashInput(event.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <span className="text-muted-foreground">Expected cash</span>
                  <span className="font-semibold">{formatMoney(expectedDrawer)}</span>
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <span className="text-muted-foreground">Over / Short</span>
                  <span className="font-semibold">
                    {varianceLabel}: {formatMoney(Math.abs(variance))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading shift totals...</p>
            )}
          </div>
        ) : null}

        {!activeShift && closePreview ? (
          <div className="mt-3 space-y-1 rounded-md bg-muted/40 p-3 text-sm">
            <p className="font-semibold">Last closed shift</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total sales</span>
                <span className="font-semibold">{formatMoney(closePreview.totalSalesCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expected cash</span>
                <span className="font-semibold">{formatMoney(closePreview.expectedCashCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Counted cash</span>
                <span className="font-semibold">{formatMoney(closePreview.shift.countedCashCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Over / Short</span>
                <span className="font-semibold">
                  {closePreview.cashOverShortCents === 0
                    ? "Balanced"
                    : closePreview.cashOverShortCents > 0
                      ? `Over ${formatMoney(closePreview.cashOverShortCents)}`
                      : `Short ${formatMoney(Math.abs(closePreview.cashOverShortCents))}`}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {shiftError && activeShift ? <p className="mt-2 text-sm text-destructive">{shiftError}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={handleShowHistory}>
          Recent sales
        </Button>
        {activeReceipt ? (
          <Button variant="outline" onClick={handlePrint}>
            Print receipt
          </Button>
        ) : null}
        <Button onClick={handleNewSale}>New sale</Button>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <PosScanBar
            value={scanValue}
            onChange={setScanValue}
            onSubmit={handleSubmit}
            isPending={isPending}
            disabled={!isCheckoutMode}
            error={error}
          />
          <PosCartTable
            lines={state.lines}
            onQuantityChange={handleQuantityChange}
            onUomChange={handleUomChange}
            onRemove={(line) => removeLine(line.id)}
            isPending={isPending || !isCheckoutMode}
          />
        </div>
        <div className="w-full space-y-3 lg:w-96">{rightContent}</div>
      </div>
    </div>
  );
}
