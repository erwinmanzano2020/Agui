"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { lookupProductAction, saveProductAction } from "./actions";
import type {
  ProductEncodingInput,
  ProductLookupResult,
  ProductSnapshot,
} from "@/lib/pos/products/server";
import { ProductValidationError } from "@/lib/pos/products/server";

type UomDraft = {
  code: string;
  name?: string;
  factorToBase: number;
  variantLabel?: string;
  allowBranchOverride?: boolean;
  isBase?: boolean;
};

type BarcodeDraft = { code: string; uomCode?: string; isPrimary?: boolean };

type TierDraft = { minQuantity: number; unitPrice: number };

type PriceDraft = {
  uomCode?: string;
  priceType: string;
  tierTag: string;
  unitPrice: number;
  currency: string;
  costCents?: number;
  markupPercent?: number;
  suggestedPriceCents?: number;
  tiers: TierDraft[];
};

type RawInputDraft = {
  rawItemId: string;
  inputUomCode?: string;
  outputUomCode?: string;
  quantity: number;
  expectedYield?: number;
};

type BundleDraft = {
  childItemId: string;
  childUomCode?: string;
  quantity: number;
  costStrategy?: string;
};

type FormDraft = {
  itemId?: string | null;
  globalItemId?: string | null;
  name: string;
  shortName: string;
  category: string;
  brand: string;
  allowInPos: boolean;
  isSellable: boolean;
  isRawMaterial: boolean;
  isRepacked: boolean;
  isBundle: boolean;
  trackInventory: boolean;
  metaText: string;
  priceCurrency: string;
  uoms: UomDraft[];
  barcodes: BarcodeDraft[];
  prices: PriceDraft[];
  rawInputs: RawInputDraft[];
  bundleComponents: BundleDraft[];
};

const EMPTY_DRAFT: FormDraft = {
  name: "",
  shortName: "",
  category: "",
  brand: "",
  allowInPos: true,
  isSellable: true,
  isRawMaterial: false,
  isRepacked: false,
  isBundle: false,
  trackInventory: true,
  metaText: "{}",
  priceCurrency: "PHP",
  uoms: [{ code: "PC", name: "Piece", factorToBase: 1, isBase: true }],
  barcodes: [],
  prices: [
    {
      uomCode: "PC",
      priceType: "RETAIL",
      tierTag: "default",
      unitPrice: 0,
      currency: "PHP",
      tiers: [],
    },
  ],
  rawInputs: [],
  bundleComponents: [],
};

function makeEmptyDraft(barcode?: string | null): FormDraft {
  const draft: FormDraft = {
    ...EMPTY_DRAFT,
    uoms: [...EMPTY_DRAFT.uoms],
    prices: [...EMPTY_DRAFT.prices],
    barcodes: barcode ? [{ code: barcode, isPrimary: true }] : [],
    rawInputs: [],
    bundleComponents: [],
  };
  return draft;
}

function snapshotToDraft(snapshot: ProductSnapshot): FormDraft {
  const uomById = new Map(snapshot.uoms.map((uom) => [uom.id, uom]));
  const base = snapshot.uoms.find((uom) => uom.is_base) ?? snapshot.uoms[0];
  const prices = snapshot.prices.map((price) => ({
    uomCode: price.uom_id ? uomById.get(price.uom_id)?.code : base?.code,
    priceType: price.price_type ?? "RETAIL",
    tierTag: price.tier_tag ?? "default",
    unitPrice: price.unit_price,
    currency: price.currency,
    costCents: price.cost_cents ?? undefined,
    markupPercent: price.markup_percent ?? undefined,
    suggestedPriceCents: price.suggested_price_cents ?? undefined,
    tiers: (price.tiers ?? []).map((tier) => ({ minQuantity: tier.min_quantity, unitPrice: tier.unit_price })),
  }));
  return {
    itemId: snapshot.item.id,
    globalItemId: snapshot.item.global_item_id,
    name: snapshot.item.name,
    shortName: snapshot.item.short_name ?? "",
    brand: snapshot.item.brand ?? "",
    category: snapshot.item.category ?? "",
    allowInPos: snapshot.item.allow_in_pos,
    isSellable: snapshot.item.is_sellable,
    isRawMaterial: snapshot.item.is_raw_material,
    isRepacked: snapshot.item.is_repacked,
    isBundle: snapshot.item.is_bundle,
    trackInventory: snapshot.item.track_inventory,
    metaText: JSON.stringify(snapshot.item.meta ?? {}, null, 2),
    priceCurrency: prices[0]?.currency ?? "PHP",
    uoms: snapshot.uoms.map((uom) => ({
      code: uom.code,
      name: uom.name ?? undefined,
      factorToBase: Number(uom.factor_to_base),
      variantLabel: uom.variant_label ?? undefined,
      allowBranchOverride: uom.allow_branch_override,
      isBase: uom.is_base,
    })),
    barcodes: snapshot.barcodes.map((barcode) => ({
      code: barcode.barcode,
      uomCode: barcode.uom_id ? uomById.get(barcode.uom_id)?.code : undefined,
      isPrimary: barcode.is_primary,
    })),
    prices,
    rawInputs: (snapshot.rawInputs ?? []).map((row) => ({
      rawItemId: row.raw_item_id,
      inputUomCode: row.input_uom_id ? uomById.get(row.input_uom_id)?.code : undefined,
      outputUomCode: row.output_uom_id ? uomById.get(row.output_uom_id)?.code : undefined,
      quantity: row.quantity,
      expectedYield: row.expected_yield ?? undefined,
    })),
    bundleComponents: (snapshot.bundles ?? []).map((row) => ({
      childItemId: row.child_item_id,
      childUomCode: row.child_uom_id ? uomById.get(row.child_uom_id)?.code : undefined,
      quantity: row.quantity,
      costStrategy: row.cost_strategy ?? undefined,
    })),
  } satisfies FormDraft;
}

function parseMeta(metaText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(metaText || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn("Failed to parse meta text", error);
    return {};
  }
}

function draftToPayload(draft: FormDraft): ProductEncodingInput {
  const base = draft.uoms.find((uom) => uom.isBase) ?? draft.uoms[0];
  const variants = draft.uoms.filter((uom) => uom !== base);
  return {
    itemId: draft.itemId,
    globalItemId: draft.globalItemId,
    name: draft.name,
    shortName: draft.shortName,
    category: draft.category,
    brand: draft.brand,
    allowInPos: draft.allowInPos,
    isSellable: draft.isSellable,
    isRawMaterial: draft.isRawMaterial,
    isRepacked: draft.isRepacked,
    isBundle: draft.isBundle,
    trackInventory: draft.trackInventory,
    meta: parseMeta(draft.metaText),
    baseUom: {
      code: base?.code ?? "",
      name: base?.name,
      variantLabel: base?.variantLabel,
      allowBranchOverride: base?.allowBranchOverride,
    },
    variants: variants.map((variant) => ({
      code: variant.code,
      name: variant.name,
      factorToBase: variant.factorToBase,
      variantLabel: variant.variantLabel,
      allowBranchOverride: variant.allowBranchOverride,
    })),
    barcodes: draft.barcodes,
    prices: draft.prices.map((price) => ({
      uomCode: price.uomCode ?? base?.code,
      priceType: price.priceType,
      tierTag: price.tierTag,
      unitPrice: price.unitPrice,
      currency: price.currency,
      costCents: price.costCents,
      markupPercent: price.markupPercent,
      suggestedPriceCents: price.suggestedPriceCents,
      tiers: price.tiers,
    })),
    priceCurrency: draft.priceCurrency,
    rawInputs: draft.rawInputs,
    bundleComponents: draft.bundleComponents,
  } satisfies ProductEncodingInput;
}

function updateListItem<T>(list: T[], index: number, next: Partial<T>): T[] {
  return list.map((entry, i) => (i === index ? { ...entry, ...next } : entry));
}

function addBarcodeIfMissing(barcodes: BarcodeDraft[], barcode: string, baseUomCode: string): BarcodeDraft[] {
  if (!barcode) return barcodes;
  if (barcodes.some((entry) => entry.code === barcode)) return barcodes;
  const next = [...barcodes, { code: barcode, uomCode: baseUomCode, isPrimary: barcodes.length === 0 }];
  if (!next.some((entry) => entry.isPrimary)) {
    next[0]!.isPrimary = true;
  }
  return next;
}

export function ProductEncodingForm({ houseId }: { houseId: string }) {
  const [draft, setDraft] = useState<FormDraft>(() => makeEmptyDraft());
  const [lookupBarcode, setLookupBarcode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [savePending, startSave] = useTransition();
  const [globalFields, setGlobalFields] = useState<Set<string>>(new Set());
  const nameInputRef = useRef<HTMLInputElement>(null);

  const payload = useMemo(() => draftToPayload(draft), [draft]);

  const baseUomCode = draft.uoms.find((uom) => uom.isBase)?.code ?? draft.uoms[0]?.code ?? "";

  const markFromGlobal = (fields: string[]) => {
    setGlobalFields(new Set(fields));
  };

  const applyGlobalPrefill = (result: ProductLookupResult) => {
    if (!result.global) return;
    const fields: string[] = [];
    setDraft((prev) => {
      const next = { ...prev, globalItemId: result.global?.id ?? prev.globalItemId };
      if (!next.name && result.global?.name) {
        next.name = result.global.name;
        fields.push("name");
      }
      if (!next.shortName && result.global?.default_shortname) {
        next.shortName = result.global.default_shortname;
        fields.push("shortName");
      }
      if (!next.brand && result.global?.brand) {
        next.brand = result.global.brand;
        fields.push("brand");
      }
      if (!next.category && result.global?.default_category) {
        next.category = result.global.default_category;
        fields.push("category");
      }
      if (result.global?.default_uom) {
        const updatedUoms = next.uoms.map((uom, index) =>
          index === 0
            ? { ...uom, code: result.global?.default_uom ?? uom.code, isBase: true, factorToBase: 1 }
            : uom,
        );
        next.uoms = updatedUoms;
        fields.push("uoms");
      }
      next.barcodes = addBarcodeIfMissing(next.barcodes, result.barcode, next.uoms[0]?.code ?? baseUomCode);
      return next;
    });
    markFromGlobal(fields);
  };

  const handleLookup = () => {
    const code = lookupBarcode.trim();
    if (!code) {
      setStatus("Enter a barcode before looking up.");
      return;
    }

    startLookup(async () => {
      try {
        const result = await lookupProductAction({ houseId, barcode: code });
        if (result.snapshot) {
          setDraft(snapshotToDraft(result.snapshot));
          setGlobalFields(new Set());
          setStatus("Found an existing product. Loaded details for editing.");
        } else if (result.global) {
          applyGlobalPrefill(result);
          setStatus("Loaded global product info. Please complete store-specific details.");
        } else {
          setDraft(makeEmptyDraft(result.barcode));
          setGlobalFields(new Set());
          setStatus("No match found. Started a new item with the scanned barcode.");
        }
        nameInputRef.current?.focus();
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
        setGlobalFields(new Set());
        setStatus("Product saved.");
      } catch (error) {
        if (error instanceof ProductValidationError && error.issues.length > 0) {
          setStatus(`${error.message}: ${error.issues.join(", ")}`);
        } else {
          setStatus(error instanceof Error ? error.message : "Save failed.");
        }
      }
    });
  };

  const optionsForUom = draft.uoms.map((uom) => (
    <option key={uom.code} value={uom.code}>
      {uom.code || "(blank)"}
    </option>
  ));

  const globalHint = (field: string) => (globalFields.has(field) ? <span className="text-[10px] text-primary">Prefilled</span> : null);

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Basics</h3>
              {globalHint("name")}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">Name</label>
              <input
                ref={nameInputRef}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full display name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Short name {globalHint("shortName")}
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.shortName}
                  onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
                  placeholder="Receipt label"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Brand {globalHint("brand")}
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.brand}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-1 pt-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Category {globalHint("category")}
              </label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="Snacks, Beverage, …"
              />
            </div>
            <div className="flex flex-wrap gap-4 pt-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.allowInPos}
                  onChange={(e) => setDraft({ ...draft, allowInPos: e.target.checked })}
                />
                <span>Allow in POS</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isSellable}
                  onChange={(e) => setDraft({ ...draft, isSellable: e.target.checked })}
                />
                <span>Sellable</span>
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
            <div className="flex flex-wrap gap-4 pt-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isRepacked}
                  onChange={(e) => setDraft({ ...draft, isRepacked: e.target.checked })}
                />
                <span>Repacked</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isBundle}
                  onChange={(e) => setDraft({ ...draft, isBundle: e.target.checked })}
                />
                <span>Bundle</span>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Units of measure</h3>
              <button
                type="button"
                className="text-xs text-primary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    uoms: [...draft.uoms, { code: "", name: "", factorToBase: 1, isBase: false }],
                  })
                }
              >
                Add UOM
              </button>
            </div>
            <div className="space-y-2">
              {draft.uoms.map((uom, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <input
                    className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={uom.code}
                    onChange={(e) => setDraft({ ...draft, uoms: updateListItem(draft.uoms, index, { code: e.target.value }) })}
                    placeholder="PC"
                  />
                  <input
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={uom.name ?? ""}
                    onChange={(e) => setDraft({ ...draft, uoms: updateListItem(draft.uoms, index, { name: e.target.value }) })}
                    placeholder="Piece"
                  />
                  <input
                    type="number"
                    className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={uom.factorToBase}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        uoms: updateListItem(draft.uoms, index, {
                          factorToBase: Number(e.target.value),
                        }),
                      })
                    }
                    placeholder="1"
                  />
                  <input
                    className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={uom.variantLabel ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        uoms: updateListItem(draft.uoms, index, { variantLabel: e.target.value }),
                      })
                    }
                    placeholder="e.g. Roll"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={uom.allowBranchOverride ?? false}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          uoms: updateListItem(draft.uoms, index, { allowBranchOverride: e.target.checked }),
                        })
                      }
                    />
                    Allow override
                  </label>
                  <button
                    type="button"
                    className={`rounded-md border px-2 py-1 text-xs ${uom.isBase ? "border-primary text-primary" : "border-input text-muted-foreground"}`}
                    onClick={() => {
                      const newBaseCode = uom.code || baseUomCode;
                      setDraft({
                        ...draft,
                        uoms: draft.uoms.map((entry, i) => ({
                          ...entry,
                          isBase: i === index,
                          factorToBase: i === index ? 1 : entry.factorToBase,
                        })),
                        prices: draft.prices.map((price) =>
                          price.uomCode === baseUomCode ? { ...price, uomCode: newBaseCode } : price,
                        ),
                        barcodes: draft.barcodes.map((barcode) =>
                          barcode.uomCode === baseUomCode ? { ...barcode, uomCode: newBaseCode } : barcode,
                        ),
                      });
                    }}
                  >
                    {uom.isBase ? "Base" : "Set as base"}
                  </button>
                  {draft.uoms.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() => setDraft({ ...draft, uoms: draft.uoms.filter((_, i) => i !== index) })}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Barcodes</span>
              <button
                type="button"
                className="text-primary"
                onClick={() => setDraft({ ...draft, barcodes: [...draft.barcodes, { code: "", uomCode: baseUomCode }] })}
              >
                Add barcode
              </button>
            </div>
            {draft.barcodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Link a barcode to speed up scanning.</p>
            ) : (
              <div className="space-y-2">
                {draft.barcodes.map((barcode, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={barcode.code}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          barcodes: updateListItem(draft.barcodes, index, {
                            code: e.target.value,
                          }),
                        })
                      }
                      placeholder="Scan barcode"
                    />
                    <select
                      className="w-32 rounded-md border border-input bg-background px-2 py-2 text-sm"
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
                      {optionsForUom}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={barcode.isPrimary ?? false}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            barcodes: draft.barcodes.map((entry, i) => ({
                              ...entry,
                              isPrimary: i === index ? e.target.checked : e.target.checked ? false : entry.isPrimary,
                            })),
                          })
                        }
                      />
                      Primary
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() => setDraft({ ...draft, barcodes: draft.barcodes.filter((_, i) => i !== index) })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Prices</span>
              <button
                type="button"
                className="text-primary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    prices: [
                      ...draft.prices,
                      {
                        uomCode: baseUomCode,
                        priceType: "RETAIL",
                        tierTag: "default",
                        unitPrice: 0,
                        currency: draft.priceCurrency,
                        tiers: [],
                      },
                    ],
                  })
                }
              >
                Add price row
              </button>
            </div>
            <div className="space-y-3">
              {draft.prices.map((price, index) => (
                <div key={index} className="rounded-md border border-input p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={price.uomCode ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          prices: updateListItem(draft.prices, index, { uomCode: e.target.value || undefined }),
                        })
                      }
                    >
                      {optionsForUom}
                    </select>
                    <div className="flex gap-2">
                      <input
                        className="w-24 rounded-md border border-input bg-background px-2 py-2 text-sm"
                        value={price.priceType}
                        onChange={(e) =>
                          setDraft({ ...draft, prices: updateListItem(draft.prices, index, { priceType: e.target.value }) })
                        }
                        placeholder="RETAIL"
                      />
                      <input
                        className="w-24 rounded-md border border-input bg-background px-2 py-2 text-sm"
                        value={price.tierTag}
                        onChange={(e) =>
                          setDraft({ ...draft, prices: updateListItem(draft.prices, index, { tierTag: e.target.value }) })
                        }
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={price.unitPrice}
                      onChange={(e) =>
                        setDraft({ ...draft, prices: updateListItem(draft.prices, index, { unitPrice: Number(e.target.value) }) })
                      }
                      placeholder="Unit price"
                    />
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={price.currency}
                      onChange={(e) =>
                        setDraft({ ...draft, prices: updateListItem(draft.prices, index, { currency: e.target.value }) })
                      }
                      placeholder="Currency"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <input
                      type="number"
                      className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={price.costCents ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          prices: updateListItem(draft.prices, index, { costCents: Number(e.target.value) || 0 }),
                        })
                      }
                      placeholder="Cost (¢)"
                    />
                    <input
                      type="number"
                      className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={price.markupPercent ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          prices: updateListItem(draft.prices, index, {
                            markupPercent: Number(e.target.value) || 0,
                          }),
                        })
                      }
                      placeholder="Markup %"
                    />
                    <input
                      type="number"
                      className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={price.suggestedPriceCents ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          prices: updateListItem(draft.prices, index, {
                            suggestedPriceCents: Number(e.target.value) || 0,
                          }),
                        })
                      }
                      placeholder="Suggested (¢)"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Price tiers</span>
                      <button
                        type="button"
                        className="text-primary"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            prices: updateListItem(draft.prices, index, {
                              tiers: [...price.tiers, { minQuantity: 1, unitPrice: price.unitPrice }],
                            }),
                          })
                        }
                      >
                        Add tier
                      </button>
                    </div>
                    {price.tiers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Optional: reward larger baskets with better prices.</p>
                    ) : (
                      <div className="space-y-2">
                        {price.tiers.map((tier, tierIndex) => (
                          <div key={tierIndex} className="flex items-center gap-2 text-xs">
                            <input
                              type="number"
                              className="w-24 rounded-md border border-input bg-background px-2 py-2"
                              value={tier.minQuantity}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  prices: updateListItem(draft.prices, index, {
                                    tiers: updateListItem(price.tiers, tierIndex, {
                                      minQuantity: Number(e.target.value),
                                    }),
                                  }),
                                })
                              }
                              placeholder="Min qty"
                            />
                            <input
                              type="number"
                              className="w-28 rounded-md border border-input bg-background px-2 py-2"
                              value={tier.unitPrice}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  prices: updateListItem(draft.prices, index, {
                                    tiers: updateListItem(price.tiers, tierIndex, {
                                      unitPrice: Number(e.target.value),
                                    }),
                                  }),
                                })
                              }
                              placeholder="Unit price"
                            />
                            <button
                              type="button"
                              className="text-muted-foreground"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  prices: updateListItem(draft.prices, index, {
                                    tiers: price.tiers.filter((_, i) => i !== tierIndex),
                                  }),
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
                  <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                    <span>
                      Type: {price.priceType} • Tier tag: {price.tierTag}
                    </span>
                    {draft.prices.length > 1 ? (
                      <button
                        type="button"
                        className="text-muted-foreground"
                        onClick={() => setDraft({ ...draft, prices: draft.prices.filter((_, i) => i !== index) })}
                      >
                        Remove row
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Raw / repack / bundle links</span>
              <span className="text-[10px] text-muted-foreground">Optional</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Raw inputs</span>
                <button
                  type="button"
                  className="text-primary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      rawInputs: [...draft.rawInputs, { rawItemId: "", quantity: 1, outputUomCode: baseUomCode }],
                    })
                  }
                >
                  Add raw input
                </button>
              </div>
              {draft.rawInputs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Link source materials for repacked items.</p>
              ) : (
                <div className="space-y-2">
                  {draft.rawInputs.map((input, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 text-xs">
                      <input
                        className="w-40 rounded-md border border-input bg-background px-2 py-2"
                        value={input.rawItemId}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            rawInputs: updateListItem(draft.rawInputs, index, { rawItemId: e.target.value }),
                          })
                        }
                        placeholder="Raw item ID"
                      />
                      <input
                        type="number"
                        className="w-24 rounded-md border border-input bg-background px-2 py-2"
                        value={input.quantity}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            rawInputs: updateListItem(draft.rawInputs, index, { quantity: Number(e.target.value) }),
                          })
                        }
                        placeholder="Qty"
                      />
                      <select
                        className="w-32 rounded-md border border-input bg-background px-2 py-2"
                        value={input.outputUomCode ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            rawInputs: updateListItem(draft.rawInputs, index, {
                              outputUomCode: e.target.value || undefined,
                            }),
                          })
                        }
                      >
                        {optionsForUom}
                      </select>
                      <button
                        type="button"
                        className="text-muted-foreground"
                        onClick={() => setDraft({ ...draft, rawInputs: draft.rawInputs.filter((_, i) => i !== index) })}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Bundle components</span>
                <button
                  type="button"
                  className="text-primary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      bundleComponents: [...draft.bundleComponents, { childItemId: "", quantity: 1 }],
                    })
                  }
                >
                  Add component
                </button>
              </div>
              {draft.bundleComponents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Optional: link child SKUs for bundles.</p>
              ) : (
                <div className="space-y-2">
                  {draft.bundleComponents.map((component, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 text-xs">
                      <input
                        className="w-40 rounded-md border border-input bg-background px-2 py-2"
                        value={component.childItemId}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bundleComponents: updateListItem(draft.bundleComponents, index, {
                              childItemId: e.target.value,
                            }),
                          })
                        }
                        placeholder="Child item ID"
                      />
                      <input
                        type="number"
                        className="w-24 rounded-md border border-input bg-background px-2 py-2"
                        value={component.quantity}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bundleComponents: updateListItem(draft.bundleComponents, index, {
                              quantity: Number(e.target.value),
                            }),
                          })
                        }
                        placeholder="Qty"
                      />
                      <input
                        className="w-28 rounded-md border border-input bg-background px-2 py-2"
                        value={component.costStrategy ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bundleComponents: updateListItem(draft.bundleComponents, index, {
                              costStrategy: e.target.value,
                            }),
                          })
                        }
                        placeholder="Cost strategy"
                      />
                      <button
                        type="button"
                        className="text-muted-foreground"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            bundleComponents: draft.bundleComponents.filter((_, i) => i !== index),
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

            <div className="space-y-1 pt-2">
              <label className="block text-xs font-medium text-muted-foreground">Metadata (JSON)</label>
              <textarea
                className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.metaText}
                onChange={(e) => setDraft({ ...draft, metaText: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground"
          onClick={() => {
            setDraft(makeEmptyDraft());
            setGlobalFields(new Set());
          }}
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
