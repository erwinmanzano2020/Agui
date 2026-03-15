"use client";

import { useActionState, useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { handleInventoryAction } from "./actions";
import type { InventoryItemState, InventoryScanState } from "./state";

type InventoryScanHudProps = {
  slug: string;
  houseName: string;
  initialState: InventoryScanState;
};

function formatPriceInput(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "";
  }
  return (value / 100).toFixed(2);
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function StatusBanner({ state }: { state: InventoryScanState }) {
  if (!state.message) return null;
  const toneClass =
    state.status === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : state.status === "success"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", toneClass)}>
      {state.message}
    </div>
  );
}

function InventoryItemCard({
  item,
  slug,
  pending,
  highlight,
  formAction,
}: {
  item: InventoryItemState;
  slug: string;
  pending: boolean;
  highlight: boolean;
  formAction: (formData: FormData) => void;
}) {
  const updatedAt = formatTimestamp(item.updatedAt);
  const itemUpdatedAt = formatTimestamp(item.itemUpdatedAt);
  return (
    <form
      action={formAction}
      className={cn(
        "rounded-lg border border-border/70 bg-muted/10 p-4 shadow-sm transition-colors",
        highlight &&
          "border-[color-mix(in_srgb,_var(--agui-primary)_45%,_var(--agui-border)_55%)] bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)]"
      )}
    >
      <input type="hidden" name="mode" value="update" />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="house_item_id" value={item.houseItemId} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">{item.itemName}</h3>
            {item.itemDescription && (
              <p className="text-xs text-muted-foreground">{item.itemDescription}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {item.barcodes.length > 0 ? (
              item.barcodes.map((code) => (
                <Badge key={code} tone="on">
                  {code}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No barcodes linked yet.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {updatedAt && <span>House updated {updatedAt}</span>}
            {itemUpdatedAt && <span>Catalog updated {itemUpdatedAt}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:w-80">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`${item.houseItemId}-sku`}>
              SKU
            </label>
            <Input
              id={`${item.houseItemId}-sku`}
              name="sku"
              placeholder="Add SKU"
              defaultValue={item.sku ?? ""}
              key={`${item.houseItemId}-sku-${item.updatedAt}`}
              disabled={pending}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`${item.houseItemId}-price`}>
              Price
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={`${item.houseItemId}-price`}
                name="price"
                placeholder="0.00"
                defaultValue={formatPriceInput(item.priceCents)}
                key={`${item.houseItemId}-price-${item.updatedAt}`}
                disabled={pending}
                inputMode="decimal"
                pattern="^\\d+(\\.\\d{0,2})?$"
              />
              <span className="text-xs text-muted-foreground">{item.priceCurrency}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`${item.houseItemId}-stock`}>
              Stock
            </label>
            <Input
              id={`${item.houseItemId}-stock`}
              name="stock"
              placeholder="0"
              defaultValue={item.stockQuantity.toString()}
              key={`${item.houseItemId}-stock-${item.updatedAt}`}
              disabled={pending}
              inputMode="numeric"
              pattern="^\\d+$"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          These details stay scoped to this company. Global catalog updates remain in sync across other locations.
        </p>
        <Button type="submit" disabled={pending} className="sm:w-36">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryScanHud({ slug, houseName, initialState }: InventoryScanHudProps) {
  const [state, formAction, pending] = useActionState(handleInventoryAction, initialState);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = barcodeInputRef.current;
    if (!input) return;
    if (!pending) {
      if (state.status === "success") {
        input.value = "";
      }
      input.focus();
    }
  }, [state.status, pending]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Adopt by barcode</h2>
          <p className="text-sm text-muted-foreground">
            Scan or paste a barcode to link it to {houseName}. We’ll create a placeholder item when it isn’t in the catalog yet.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="mode" value="scan" />
            <input type="hidden" name="slug" value={slug} />
            <label htmlFor="inventory-barcode" className="text-sm font-medium text-foreground">
              Scan barcode
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                id="inventory-barcode"
                name="barcode"
                ref={barcodeInputRef}
                placeholder="Scan or type a barcode"
                required
                disabled={pending}
                className="sm:flex-1"
              />
              <Button type="submit" disabled={pending} className="sm:w-40">
                {pending ? "Processing…" : "Adopt item"}
              </Button>
            </div>
          </form>
          <StatusBanner state={state} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Inventory details</h2>
          <p className="text-sm text-muted-foreground">
            Adjust price, SKU, and stock per house. These edits stay scoped to this location.
          </p>
        </CardHeader>
        <CardContent>
          {state.items.length === 0 ? (
            <EmptyState
              title="No items adopted yet"
              description="Scan a barcode to start building this catalog."
              className="bg-muted/30"
            />
          ) : (
            <div className="space-y-4">
              {state.items.map((item) => (
                <InventoryItemCard
                  key={item.houseItemId}
                  item={item}
                  slug={slug}
                  pending={pending}
                  highlight={state.highlightHouseItemId === item.houseItemId}
                  formAction={formAction}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
