"use client";

import { useMemo, useState, useTransition } from "react";

import { lookupProductAction, saveProductAction } from "./actions";
import type { ProductEncodingInput, ProductSnapshot } from "@/lib/pos/products/server";

type UomDraft = { code: string; name?: string; factorToBase: number };
type BarcodeDraft = { code: string; uomCode?: string; isPrimary?: boolean };
type TierDraft = { minQuantity: number; unitPrice: number };

type FormDraft = {
  itemId?: string | null;
  name: string;
  shortName: string;
  category: string;
  brand: string;
  isSellable: boolean;
  isRawMaterial: boolean;
  trackInventory: boolean;
  baseUom: UomDraft;
  variants: UomDraft[];
  barcodes: BarcodeDraft[];
  basePrice: number;
  tiers: TierDraft[];
};

const EMPTY_DRAFT: FormDraft = {
  name: "",
  shortName: "",
  category: "",
  brand: "",
  isSellable: true,
  isRawMaterial: false,
  trackInventory: false,
  baseUom: { code: "PC", name: "Piece", factorToBase: 1 },
  variants: [],
  barcodes: [],
  basePrice: 0,
  tiers: [],
};

function makeEmptyDraft(): FormDraft {
  return {
    ...EMPTY_DRAFT,
    baseUom: { ...EMPTY_DRAFT.baseUom },
    variants: [],
    barcodes: [],
    tiers: [],
  };
}

function snapshotToDraft(snapshot: ProductSnapshot): FormDraft {
  const baseUom = snapshot.uoms.find((uom) => uom.is_base) ?? snapshot.uoms[0];
  const variants = snapshot.uoms
    .filter((uom) => uom.id !== baseUom?.id)
    .map((uom) => ({ code: uom.code, name: uom.name ?? undefined, factorToBase: Number(uom.factor_to_base) }));

  const basePrice = snapshot.prices.find((price) => price.uom_id === baseUom?.id) ?? snapshot.prices[0];
  return {
    itemId: snapshot.item.id,
    name: snapshot.item.name,
    shortName: snapshot.item.short_name ?? "",
    category: snapshot.item.category ?? "",
    brand: snapshot.item.brand ?? "",
    isSellable: snapshot.item.is_sellable,
    isRawMaterial: snapshot.item.is_raw_material,
    trackInventory: snapshot.item.track_inventory,
    baseUom: { code: baseUom?.code ?? "", name: baseUom?.name ?? undefined, factorToBase: Number(baseUom?.factor_to_base ?? 1) },
    variants,
    barcodes: snapshot.barcodes.map((barcode) => ({
      code: barcode.barcode,
      uomCode: snapshot.uoms.find((uom) => uom.id === barcode.uom_id)?.code,
      isPrimary: barcode.is_primary,
    })),
    basePrice: basePrice?.unit_price ?? 0,
    tiers: (basePrice?.tiers ?? []).map((tier) => ({ minQuantity: tier.min_quantity, unitPrice: tier.unit_price })),
  } satisfies FormDraft;
}

function draftToPayload(draft: FormDraft): ProductEncodingInput {
  return {
    itemId: draft.itemId,
    name: draft.name,
    shortName: draft.shortName,
    category: draft.category,
    brand: draft.brand,
    isSellable: draft.isSellable,
    isRawMaterial: draft.isRawMaterial,
    trackInventory: draft.trackInventory,
    baseUom: draft.baseUom,
    variants: draft.variants,
    barcodes: draft.barcodes,
    basePrice: draft.basePrice,
    priceTiers: draft.tiers,
  } satisfies ProductEncodingInput;
}

function updateListItem<T>(list: T[], index: number, next: Partial<T>): T[] {
  return list.map((entry, i) => (i === index ? { ...entry, ...next } : entry));
}

export function ProductEncodingForm({ houseId }: { houseId: string }) {
  const [draft, setDraft] = useState<FormDraft>(() => makeEmptyDraft());
  const [lookupBarcode, setLookupBarcode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [savePending, startSave] = useTransition();

  const payload = useMemo(() => draftToPayload(draft), [draft]);

  const handleLookup = () => {
    const code = lookupBarcode.trim();
    if (!code) {
      setStatus("Enter a barcode before looking up.");
      return;
    }

    startLookup(async () => {
      try {
        const found = await lookupProductAction({ houseId, barcode: code });
        if (found) {
          setDraft(snapshotToDraft(found));
          setStatus("Loaded existing product for that barcode.");
        } else {
          setDraft((prev) => ({
            ...makeEmptyDraft(),
            barcodes: [{ code, isPrimary: true }],
            category: prev.category,
          }));
          setStatus("No match found. Start a new product.");
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Lookup failed.");
      }
    });
  };

  const handleSave = () => {
    startSave(async () => {
      try {
        const snapshot = await saveProductAction({ houseId, payload });
        setDraft(snapshotToDraft(snapshot));
        setStatus("Product saved.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Save failed.");
      }
    });
  };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Product encoding</h2>
          <p className="text-sm text-muted-foreground">Scan a barcode to auto-fill, then complete item details.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Scan or enter barcode</label>
            <input
              className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={lookupBarcode}
              onChange={(e) => setLookupBarcode(e.target.value)}
              placeholder="e.g. 1234567890123"
            />
          </div>
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            onClick={handleLookup}
            disabled={lookupPending}
            type="button"
          >
            {lookupPending ? "Looking up…" : "Lookup"}
          </button>
        </div>
      </div>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Basics</h3>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">Name</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Full display name"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Short name</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.shortName}
                onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
                placeholder="Receipt label"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Brand</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.brand}
                onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Category</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Snacks, Beverage, …"
            />
          </div>
          <div className="flex flex-wrap gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isSellable}
                onChange={(e) => setDraft({ ...draft, isSellable: e.target.checked })}
              />
              <span>Allow in POS</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isRawMaterial}
                onChange={(e) => setDraft({ ...draft, isRawMaterial: e.target.checked })}
              />
              <span>Raw material</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.trackInventory}
                onChange={(e) => setDraft({ ...draft, trackInventory: e.target.checked })}
              />
              <span>Track inventory</span>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Pricing</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Base price (centavos)</label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.basePrice}
                onChange={(e) => setDraft({ ...draft, basePrice: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Base UOM</label>
              <div className="flex gap-2">
                <input
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.baseUom.code}
                  onChange={(e) =>
                    setDraft({ ...draft, baseUom: { ...draft.baseUom, code: e.target.value } })
                  }
                  placeholder="PC"
                />
                <input
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.baseUom.name ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, baseUom: { ...draft.baseUom, name: e.target.value } })
                  }
                  placeholder="Piece"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>UOM variants</span>
              <button
                type="button"
                className="text-primary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    variants: [...draft.variants, { code: "", name: "", factorToBase: 1 }],
                  })
                }
              >
                Add variant
              </button>
            </div>
            {draft.variants.length === 0 ? (
              <p className="text-xs text-muted-foreground">No variants yet.</p>
            ) : (
              <div className="space-y-2">
                {draft.variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={variant.code}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: updateListItem(draft.variants, index, { code: e.target.value }),
                        })
                      }
                      placeholder="CASE"
                    />
                    <input
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={variant.name ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: updateListItem(draft.variants, index, { name: e.target.value }),
                        })
                      }
                      placeholder="Case"
                    />
                    <input
                      type="number"
                      className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={variant.factorToBase}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: updateListItem(draft.variants, index, {
                            factorToBase: Number(e.target.value),
                          }),
                        })
                      }
                      placeholder="12"
                    />
                    <button
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Barcodes</span>
              <button
                type="button"
                className="text-primary"
                onClick={() => setDraft({ ...draft, barcodes: [...draft.barcodes, { code: "" }] })}
              >
                Add barcode
              </button>
            </div>
            {draft.barcodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Link a barcode to speed up scanning.</p>
            ) : (
              <div className="space-y-2">
                {draft.barcodes.map((barcode, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={barcode.code}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          barcodes: updateListItem(draft.barcodes, index, { code: e.target.value }),
                        })
                      }
                      placeholder="1234567890123"
                    />
                    <select
                      className="w-28 rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={barcode.uomCode ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          barcodes: updateListItem(draft.barcodes, index, {
                            uomCode: e.target.value || undefined,
                          }),
                        })
                      }
                    >
                      <option value="">Base UOM</option>
                      {draft.variants.map((variant) => (
                        <option key={variant.code} value={variant.code}>
                          {variant.code}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={barcode.isPrimary ?? false}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            barcodes: updateListItem(draft.barcodes, index, {
                              isPrimary: e.target.checked,
                            }),
                          })
                        }
                      />
                      Primary
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() =>
                        setDraft({ ...draft, barcodes: draft.barcodes.filter((_, i) => i !== index) })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Price tiers</span>
              <button
                type="button"
                className="text-primary"
                onClick={() => setDraft({ ...draft, tiers: [...draft.tiers, { minQuantity: 1, unitPrice: draft.basePrice }] })}
              >
                Add tier
              </button>
            </div>
            {draft.tiers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Optional: reward larger baskets with better prices.</p>
            ) : (
              <div className="space-y-2">
                {draft.tiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={tier.minQuantity}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tiers: updateListItem(draft.tiers, index, {
                            minQuantity: Number(e.target.value),
                          }),
                        })
                      }
                      placeholder="5"
                    />
                    <input
                      type="number"
                      className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={tier.unitPrice}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tiers: updateListItem(draft.tiers, index, {
                            unitPrice: Number(e.target.value),
                          }),
                        })
                      }
                      placeholder="950"
                    />
                    <button
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() => setDraft({ ...draft, tiers: draft.tiers.filter((_, i) => i !== index) })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground"
          onClick={() => setDraft(makeEmptyDraft())}
        >
          Reset
        </button>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          onClick={handleSave}
          disabled={savePending}
        >
          {savePending ? "Saving…" : "Save product"}
        </button>
      </div>
    </div>
  );
}
