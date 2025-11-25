import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CustomerGroupRow,
  Database,
  ItemBarcodeInsert,
  ItemBarcodeRow,
  ItemInsert,
  ItemPriceInsert,
  ItemPriceRow,
  ItemPriceTierInsert,
  ItemPriceTierRow,
  ItemRow,
  ItemBundleInsert,
  ItemBundleRow,
  ItemRawInputInsert,
  ItemRawInputRow,
  ItemUomInsert,
  ItemUomRow,
  GlobalItemRow,
} from "@/lib/db.types";
import { getServiceSupabase } from "@/lib/supabase-service";

export type DatabaseClient = SupabaseClient<Database>;

export type ProductSnapshot = {
  item: ItemRow;
  uoms: ItemUomRow[];
  barcodes: ItemBarcodeRow[];
  prices: Array<ItemPriceRow & { tiers: ItemPriceTierRow[] }>;
  rawInputs: ItemRawInputRow[];
  bundles: ItemBundleRow[];
};

export type ProductEncodingInput = {
  itemId?: string | null;
  globalItemId?: string | null;
  name: string;
  shortName?: string | null;
  category?: string | null;
  brand?: string | null;
  allowInPos?: boolean;
  isSellable?: boolean;
  isRawMaterial?: boolean;
  isRepacked?: boolean;
  isBundle?: boolean;
  trackInventory?: boolean;
  meta?: Record<string, unknown> | null;
  baseUom: { code: string; name?: string | null; variantLabel?: string | null; allowBranchOverride?: boolean };
  variants?: Array<{
    code: string;
    name?: string | null;
    factorToBase: number;
    variantLabel?: string | null;
    allowBranchOverride?: boolean;
  }>;
  barcodes?: Array<{ code: string; uomCode?: string | null; isPrimary?: boolean }>;
  basePrice?: number;
  priceCurrency?: string;
  priceTiers?: Array<{ minQuantity: number; unitPrice: number }>;
  prices?: Array<{
    uomCode?: string | null;
    priceType?: string | null;
    tierTag?: string | null;
    unitPrice: number;
    currency?: string | null;
    costCents?: number | null;
    markupPercent?: number | null;
    suggestedPriceCents?: number | null;
    metadata?: Record<string, unknown> | null;
    tiers?: Array<{ minQuantity: number; unitPrice: number }>;
  }>;
  rawInputs?: Array<{
    rawItemId: string;
    inputUomCode?: string | null;
    outputUomCode?: string | null;
    quantity: number;
    expectedYield?: number | null;
  }>;
  bundleComponents?: Array<{
    childItemId: string;
    childUomCode?: string | null;
    quantity: number;
    costStrategy?: string | null;
  }>;
};

export type ProductRepository = {
  findBarcode(houseId: string, barcode: string): Promise<ItemBarcodeRow | null>;
  findGlobalItem(barcode: string): Promise<GlobalItemRow | null>;
  upsertItem(payload: ItemInsert): Promise<ItemRow>;
  upsertUoms(rows: ItemUomInsert[]): Promise<ItemUomRow[]>;
  upsertBarcodes(rows: ItemBarcodeInsert[]): Promise<ItemBarcodeRow[]>;
  upsertPrice(row: ItemPriceInsert): Promise<ItemPriceRow>;
  replacePriceTiers(
    houseId: string,
    priceId: string,
    tiers: ItemPriceTierInsert[],
  ): Promise<ItemPriceTierRow[]>;
  replaceRawInputs(houseId: string, finishedItemId: string, rows: ItemRawInputInsert[]): Promise<ItemRawInputRow[]>;
  replaceBundles(houseId: string, bundleParentId: string, rows: ItemBundleInsert[]): Promise<ItemBundleRow[]>;
  listPrices(houseId: string, itemId: string): Promise<ItemPriceRow[]>;
  deletePrices(priceIds: string[]): Promise<void>;
  loadSnapshot(houseId: string, itemId: string): Promise<ProductSnapshot | null>;
};

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class ProductValidationError extends Error {
  issues: string[];
  constructor(message: string, issues?: string[]) {
    super(message);
    this.name = "ProductValidationError";
    this.issues = issues ?? [];
  }
}

function assertPositiveNumber(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return value;
}

function assertCentavos(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds safe integer limits`);
  }
  return value;
}

function assertNonNegative(value: number | null | undefined, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ProductValidationError(`${label} must be zero or greater`);
  }
  return value;
}

function normalizeUoms(
  houseId: string,
  itemId: string,
  base: ProductEncodingInput["baseUom"],
  variants: ProductEncodingInput["variants"],
): ItemUomInsert[] {
  const baseCode = normalizeString(base.code);
  if (!baseCode) {
    throw new Error("Base UOM code is required");
  }

  const rows: ItemUomInsert[] = [
    {
      house_id: houseId,
      item_id: itemId,
      code: baseCode,
      name: normalizeString(base.name),
      is_base: true,
      factor_to_base: 1,
      variant_label: normalizeString(base.variantLabel),
      allow_branch_override: base.allowBranchOverride ?? false,
    },
  ];

  for (const variant of variants ?? []) {
    if (!variant) continue;
    const code = normalizeString(variant.code);
    if (!code) continue;
    rows.push({
      house_id: houseId,
      item_id: itemId,
      code,
      name: normalizeString(variant.name),
      is_base: false,
      factor_to_base: assertPositiveNumber(variant.factorToBase, `factor for ${code}`),
      variant_label: normalizeString(variant.variantLabel),
      allow_branch_override: variant.allowBranchOverride ?? false,
    });
  }

  return rows;
}

export function resolveTierForQuantity(
  tiers: ItemPriceTierRow[],
  quantity: number,
): ItemPriceTierRow | null {
  if (!tiers || tiers.length === 0) return null;
  const sanitized = tiers
    .filter(Boolean)
    .map((tier) => ({ ...tier, min_quantity: Math.max(1, tier.min_quantity) }))
    .sort((a, b) => a.min_quantity - b.min_quantity || a.unit_price - b.unit_price);

  let selected: ItemPriceTierRow | null = null;
  for (const tier of sanitized) {
    if (quantity >= tier.min_quantity) {
      selected = tier;
    } else {
      break;
    }
  }
  return selected;
}

export function resolveUnitPrice(
  basePrice: number,
  tiers: ItemPriceTierRow[],
  quantity: number,
): number {
  const tier = resolveTierForQuantity(tiers, quantity);
  return tier ? tier.unit_price : basePrice;
}

function resolveRepository(explicit?: ProductRepository | null, supabase?: DatabaseClient | null): ProductRepository {
  if (explicit) return explicit;
  const client = supabase ?? getServiceSupabase<Database>();
  return createSupabaseProductRepository(client);
}

export type ProductLookupResult = { barcode: string; snapshot: ProductSnapshot | null; global: GlobalItemRow | null };

export async function lookupProductByBarcode({
  houseId,
  barcode,
  supabase,
  repo,
}: {
  houseId: string;
  barcode: string;
  supabase?: DatabaseClient | null;
  repo?: ProductRepository | null;
}): Promise<ProductLookupResult> {
  const normalized = normalizeString(barcode);
  if (!normalized) {
    throw new Error("Barcode is required for lookup");
  }
  const store = resolveRepository(repo, supabase);
  const match = await store.findBarcode(houseId, normalized);
  const snapshot = match ? await store.loadSnapshot(houseId, match.item_id) : null;
  const global = snapshot ? null : await store.findGlobalItem(normalized);
  return { barcode: normalized, snapshot, global } satisfies ProductLookupResult;
}

function normalizePriceTiers(
  houseId: string,
  priceId: string,
  tiers: ProductEncodingInput["priceTiers"],
): ItemPriceTierInsert[] {
  const rows: ItemPriceTierInsert[] = [];
  for (const tier of tiers ?? []) {
    if (!tier) continue;
    const quantity = Math.max(1, Math.trunc(assertPositiveNumber(tier.minQuantity, "minQuantity")));
    const unit = assertCentavos(tier.unitPrice, "tier price");
    rows.push({ house_id: houseId, item_price_id: priceId, min_quantity: quantity, unit_price: unit });
  }
  return rows;
}

export async function upsertProductFromEncoding({
  houseId,
  payload,
  supabase,
  repo,
}: {
  houseId: string;
  payload: ProductEncodingInput;
  supabase?: DatabaseClient | null;
  repo?: ProductRepository | null;
}): Promise<ProductSnapshot> {
  const store = resolveRepository(repo, supabase);
  const issues: string[] = [];
  const itemName = normalizeString(payload.name);
  if (!itemName) {
    issues.push("Product name is required");
  }
  const baseCode = normalizeString(payload.baseUom?.code);
  if (!baseCode) {
    issues.push("Base UOM code is required");
  }

  const shortName = normalizeString(payload.shortName) ?? (itemName ? itemName.slice(0, 24) : null);
  const isSellable = payload.isSellable ?? true;
  const allowInPos = payload.allowInPos ?? isSellable;
  const isRawMaterial = payload.isRawMaterial ?? false;
  const trackInventory = payload.trackInventory ?? true;

  const barcodeCodes = (payload.barcodes ?? []).map((entry) => normalizeString(entry?.code)).filter(Boolean);
  if (allowInPos && barcodeCodes.length === 0) {
    issues.push("At least one barcode is required for POS-ready items");
  }

  if (issues.length > 0) {
    throw new ProductValidationError("Invalid product encoding payload", issues);
  }

  const targetBarcode = payload.barcodes?.find((entry) => !!normalizeString(entry?.code));
  let itemId = normalizeString(payload.itemId) ?? null;
  if (!itemId && targetBarcode) {
    const found = await store.findBarcode(houseId, normalizeString(targetBarcode.code)!);
    if (found) {
      itemId = found.item_id;
    }
  }

  const item = await store.upsertItem({
    id: itemId ?? undefined,
    house_id: houseId,
    name: itemName!,
    short_name: shortName,
    brand: normalizeString(payload.brand),
    category: normalizeString(payload.category),
    is_sellable: isSellable,
    is_raw_material: isRawMaterial,
    is_repacked: payload.isRepacked ?? false,
    is_bundle: payload.isBundle ?? false,
    allow_in_pos: allowInPos,
    global_item_id: normalizeString(payload.globalItemId),
    track_inventory: trackInventory,
    meta: (payload.meta as ItemInsert["meta"]) ?? {},
  });

  const uoms = await store.upsertUoms(normalizeUoms(houseId, item.id, payload.baseUom, payload.variants));
  const uomByCode = new Map(uoms.map((row) => [row.code, row]));
  const baseUom = uoms.find((uom) => uom.is_base) ?? uoms[0];

  const barcodes: ItemBarcodeInsert[] = [];
  for (const entry of payload.barcodes ?? []) {
    if (!entry) continue;
    const code = normalizeString(entry.code);
    if (!code) continue;
    const linkedUom =
      entry.uomCode === undefined ? baseUom : entry.uomCode ? uomByCode.get(entry.uomCode) : null;
    barcodes.push({
      house_id: houseId,
      item_id: item.id,
      barcode: code,
      is_primary: entry.isPrimary ?? false,
      uom_id: linkedUom?.id ?? null,
    });
  }
  if (barcodes.length > 0 && !barcodes.some((entry) => entry.is_primary)) {
    barcodes[0]!.is_primary = true;
  }
  if (barcodes.length > 0) {
    await store.upsertBarcodes(barcodes);
  }

  const pricePayloads =
    payload.prices && payload.prices.length > 0
      ? payload.prices
      : payload.basePrice !== undefined
        ? [
            {
              uomCode: payload.baseUom.code,
              unitPrice: payload.basePrice,
              currency: payload.priceCurrency,
              tiers: payload.priceTiers,
            },
          ]
        : [];

  if (pricePayloads.length === 0 && allowInPos) {
    throw new ProductValidationError("At least one price is required for POS-ready items");
  }

  const normalizedPrices = [] as Array<
    ItemPriceInsert & {
      tiers: ProductEncodingInput["priceTiers"];
    }
  >;

  for (const entry of pricePayloads) {
    if (!entry) continue;
    const unitPrice = assertCentavos(entry.unitPrice, "unit price");
    const priceType = normalizeString(entry.priceType) ?? "RETAIL";
    const tierTag = normalizeString(entry.tierTag) ?? "default";
    const currency = normalizeString(entry.currency ?? payload.priceCurrency) ?? "PHP";
    const linkedUom =
      entry.uomCode === undefined ? baseUom : entry.uomCode ? uomByCode.get(entry.uomCode) : null;
    normalizedPrices.push({
      house_id: houseId,
      item_id: item.id,
      uom_id: linkedUom?.id ?? null,
      unit_price: unitPrice,
      currency,
      price_type: priceType,
      tier_tag: tierTag,
      cost_cents: assertNonNegative(entry.costCents ?? null, "Cost"),
      markup_percent: assertNonNegative(entry.markupPercent ?? null, "Markup"),
      suggested_price_cents: assertNonNegative(entry.suggestedPriceCents ?? null, "Suggested price"),
      metadata: (entry.metadata as ItemPriceInsert["metadata"]) ?? {},
      tiers: entry.tiers,
    });
  }

  const desiredPriceKeys = new Set(
    normalizedPrices.map((price) => `${price.uom_id ?? "__null"}::${price.price_type ?? ""}::${price.tier_tag ?? ""}`),
  );
  const existingPrices = await store.listPrices(houseId, item.id);
  const stalePriceIds = existingPrices
    .filter((price) =>
      desiredPriceKeys.has(`${price.uom_id ?? "__null"}::${price.price_type ?? ""}::${price.tier_tag ?? ""}`)
        ? false
        : true,
    )
    .map((price) => price.id);

  if (stalePriceIds.length > 0) {
    await store.deletePrices(stalePriceIds);
  }

  for (const entry of normalizedPrices) {
    const price = await store.upsertPrice(entry);
    const tierRows = normalizePriceTiers(houseId, price.id, entry.tiers);
    await store.replacePriceTiers(houseId, price.id, tierRows);
  }

  await store.replaceRawInputs(
    houseId,
    item.id,
    (payload.rawInputs ?? []).map((input) => ({
      house_id: houseId,
      finished_item_id: item.id,
      raw_item_id: input.rawItemId,
      input_uom_id: input.inputUomCode ? uomByCode.get(input.inputUomCode)?.id ?? null : null,
      output_uom_id: input.outputUomCode ? uomByCode.get(input.outputUomCode)?.id ?? null : null,
      quantity: input.quantity ?? 0,
      expected_yield: input.expectedYield ?? null,
    })),
  );

  await store.replaceBundles(
    houseId,
    item.id,
    (payload.bundleComponents ?? []).map((component) => ({
      house_id: houseId,
      bundle_parent_id: item.id,
      child_item_id: component.childItemId,
      child_uom_id: component.childUomCode ? uomByCode.get(component.childUomCode)?.id ?? null : null,
      quantity: component.quantity ?? 0,
      cost_strategy: normalizeString(component.costStrategy) ?? "proportional",
    })),
  );

  const snapshot = await store.loadSnapshot(houseId, item.id);
  if (!snapshot) {
    throw new Error("Failed to reload product after save");
  }
  return snapshot;
}

export async function getPriceForCustomerGroup({
  houseId,
  itemId,
  uomId,
  quantity,
  customerGroupId,
  supabase,
  repo,
}: {
  houseId: string;
  itemId: string;
  uomId: string | null;
  quantity: number;
  customerGroupId?: string | null;
  supabase?: DatabaseClient | null;
  repo?: ProductRepository | null;
}): Promise<{
  unitPrice: number;
  tier: ItemPriceTierRow | null;
  customerGroup: CustomerGroupRow | null;
}> {
  const store = resolveRepository(repo, supabase);
  const _customerGroupId = customerGroupId ?? null;
  const snapshot = await store.loadSnapshot(houseId, itemId);
  if (!snapshot) {
    throw new Error("Item not found for pricing");
  }

  const price =
    snapshot.prices.find(
      (entry) =>
        entry.uom_id === uomId && entry.price_type === "RETAIL" && (!entry.tier_tag || entry.tier_tag === "default"),
    ) ?? snapshot.prices.find((entry) => entry.uom_id === uomId) ?? snapshot.prices[0];
  if (!price) {
    throw new Error("No price configured for item");
  }

  const tier = resolveTierForQuantity(price.tiers, quantity);

  // Customer-group-aware pricing is not yet implemented; capture the intent for future work.
  void _customerGroupId;

  return { unitPrice: tier ? tier.unit_price : price.unit_price, tier, customerGroup: null };
}

export function createSupabaseProductRepository(client: DatabaseClient): ProductRepository {
  return {
    async findBarcode(houseId, barcode) {
      const { data, error } = await client
        .from("item_barcodes")
        .select("*")
        .eq("house_id", houseId)
        .eq("barcode", barcode)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        throw new Error(error.message);
      }
      return (data as ItemBarcodeRow | null) ?? null;
    },
    async findGlobalItem(barcode) {
      const { data, error } = await client.from("global_items").select("*").eq("barcode", barcode).maybeSingle();
      if (error && error.code !== "PGRST116") {
        throw new Error(error.message);
      }
      return (data as GlobalItemRow | null) ?? null;
    },
    async upsertItem(payload) {
      const { data, error } = await client
        .from("items")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ItemRow;
    },
    async upsertUoms(rows) {
      if (rows.length === 0) return [];
      const { data, error } = await client
        .from("item_uoms")
        .upsert(rows, { onConflict: "item_id,code" })
        .select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemUomRow[];
    },
    async upsertBarcodes(rows) {
      if (rows.length === 0) return [];
      const { data, error } = await client
        .from("item_barcodes")
        .upsert(rows, { onConflict: "house_id,barcode" })
        .select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemBarcodeRow[];
    },
    async upsertPrice(row) {
      const { data, error } = await client
        .from("item_prices")
        .upsert(row, { onConflict: "item_id,uom_id,price_type,tier_tag" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ItemPriceRow;
    },
    async listPrices(houseId, itemId) {
      const { data, error } = await client
        .from("item_prices")
        .select("*")
        .eq("house_id", houseId)
        .eq("item_id", itemId);
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemPriceRow[];
    },
    async deletePrices(priceIds) {
      if (priceIds.length === 0) return;
      const { error } = await client.from("item_prices").delete().in("id", priceIds);
      if (error) throw new Error(error.message);
    },
    async replacePriceTiers(houseId, priceId, tiers) {
      await client.from("item_price_tiers").delete().eq("item_price_id", priceId);
      if (tiers.length === 0) return [];
      const { data, error } = await client
        .from("item_price_tiers")
        .insert(tiers.map((tier) => ({ ...tier, house_id: houseId })))
        .select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemPriceTierRow[];
    },
    async replaceRawInputs(houseId, finishedItemId, rows) {
      await client.from("item_raw_inputs").delete().eq("finished_item_id", finishedItemId);
      if (rows.length === 0) return [];
      const { data, error } = await client.from("item_raw_inputs").insert(rows).select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemRawInputRow[];
    },
    async replaceBundles(houseId, bundleParentId, rows) {
      void houseId;
      await client.from("item_bundles").delete().eq("bundle_parent_id", bundleParentId);
      if (rows.length === 0) return [];
      const { data, error } = await client.from("item_bundles").insert(rows).select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as ItemBundleRow[];
    },
    async loadSnapshot(houseId, itemId) {
      const { data: item, error: itemError } = await client
        .from("items")
        .select("*")
        .eq("house_id", houseId)
        .eq("id", itemId)
        .maybeSingle();
      if (itemError) throw new Error(itemError.message);
      if (!item) return null;

      const [uomsRes, barcodesRes, pricesRes, rawInputsRes, bundlesRes] = await Promise.all([
        client.from("item_uoms").select("*").eq("item_id", itemId),
        client.from("item_barcodes").select("*").eq("item_id", itemId),
        client.from("item_prices").select("*").eq("item_id", itemId),
        client.from("item_raw_inputs").select("*").eq("finished_item_id", itemId),
        client.from("item_bundles").select("*").eq("bundle_parent_id", itemId),
      ]);

      if (uomsRes.error) throw new Error(uomsRes.error.message);
      if (barcodesRes.error) throw new Error(barcodesRes.error.message);
      if (pricesRes.error) throw new Error(pricesRes.error.message);

      const priceRows = (pricesRes.data ?? []) as ItemPriceRow[];
      const priceIds = priceRows.map((price) => price.id);
      let tierRows: ItemPriceTierRow[] = [];
      if (priceIds.length > 0) {
        const { data: tierData, error: tierError } = await client
          .from("item_price_tiers")
          .select("*")
          .in("item_price_id", priceIds);
        if (tierError) throw new Error(tierError.message);
        tierRows = (tierData ?? []) as ItemPriceTierRow[];
      }

      const prices = priceRows.map((price) => ({
        ...price,
        tiers: tierRows.filter((tier) => tier.item_price_id === price.id),
      }));

      return {
        item: item as ItemRow,
        uoms: (uomsRes.data ?? []) as ItemUomRow[],
        barcodes: (barcodesRes.data ?? []) as ItemBarcodeRow[],
        prices,
        rawInputs: (rawInputsRes.data ?? []) as ItemRawInputRow[],
        bundles: (bundlesRes.data ?? []) as ItemBundleRow[],
      } satisfies ProductSnapshot;
    },
  } satisfies ProductRepository;
}

function generateId(prefix: string, counter: number): string {
  return `${prefix}-${counter}`;
}

export function createInMemoryProductRepository(initial?: Partial<{
  items: ItemRow[];
  uoms: ItemUomRow[];
  barcodes: ItemBarcodeRow[];
  prices: ItemPriceRow[];
  tiers: ItemPriceTierRow[];
  rawInputs: ItemRawInputRow[];
  bundles: ItemBundleRow[];
  globalItems: GlobalItemRow[];
}>): ProductRepository {
  let idCounter = 1;
  const items = new Map(initial?.items?.map((row) => [row.id, row]) ?? []);
  const uoms = new Map(initial?.uoms?.map((row) => [row.id, row]) ?? []);
  const barcodes = new Map(initial?.barcodes?.map((row) => [row.id, row]) ?? []);
  const prices = new Map(initial?.prices?.map((row) => [row.id, row]) ?? []);
  const tiers = new Map(initial?.tiers?.map((row) => [row.id, row]) ?? []);
  const rawInputs = new Map(initial?.rawInputs?.map((row) => [row.id, row]) ?? []);
  const bundles = new Map(initial?.bundles?.map((row) => [row.id, row]) ?? []);
  const globalItems = new Map(initial?.globalItems?.map((row) => [row.id, row]) ?? []);

  function makeItemRow(payload: ItemInsert, id: string, existing?: ItemRow): ItemRow {
    return {
      id,
      house_id: payload.house_id ?? existing?.house_id ?? null,
      slug: payload.slug ?? existing?.slug ?? null,
      name: payload.name,
      short_name: payload.short_name ?? existing?.short_name ?? null,
      brand: payload.brand ?? existing?.brand ?? null,
      category: payload.category ?? existing?.category ?? null,
      category_id: payload.category_id ?? existing?.category_id ?? null,
      subcategory_id: payload.subcategory_id ?? existing?.subcategory_id ?? null,
      is_sellable: payload.is_sellable ?? existing?.is_sellable ?? true,
      is_raw_material: payload.is_raw_material ?? existing?.is_raw_material ?? false,
      is_repacked: payload.is_repacked ?? existing?.is_repacked ?? false,
      is_bundle: payload.is_bundle ?? existing?.is_bundle ?? false,
      allow_in_pos: payload.allow_in_pos ?? existing?.allow_in_pos ?? false,
      global_item_id: payload.global_item_id ?? existing?.global_item_id ?? null,
      track_inventory: payload.track_inventory ?? existing?.track_inventory ?? false,
      meta: payload.meta ?? existing?.meta ?? {},
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: existing ? new Date().toISOString() : null,
    } satisfies ItemRow;
  }

  function makeItemUomRow(row: ItemUomInsert, id: string, existing?: ItemUomRow): ItemUomRow {
    return {
      id,
      house_id: row.house_id,
      item_id: row.item_id,
      code: row.code,
      name: row.name ?? existing?.name ?? null,
      is_base: row.is_base ?? existing?.is_base ?? false,
      factor_to_base: row.factor_to_base ?? existing?.factor_to_base ?? 1,
      variant_label: row.variant_label ?? existing?.variant_label ?? null,
      allow_branch_override: row.allow_branch_override ?? existing?.allow_branch_override ?? false,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: existing ? new Date().toISOString() : null,
    } satisfies ItemUomRow;
  }

  function makeItemPriceRow(row: ItemPriceInsert, id: string, existing?: ItemPriceRow): ItemPriceRow {
    return {
      id,
      house_id: row.house_id,
      item_id: row.item_id,
      uom_id: row.uom_id ?? null,
      unit_price: row.unit_price,
      currency: row.currency ?? existing?.currency ?? "PHP",
      price_type: row.price_type ?? existing?.price_type ?? "base",
      tier_tag: row.tier_tag ?? existing?.tier_tag ?? null,
      cost_cents: row.cost_cents ?? existing?.cost_cents ?? null,
      markup_percent: row.markup_percent ?? existing?.markup_percent ?? null,
      suggested_price_cents: row.suggested_price_cents ?? existing?.suggested_price_cents ?? null,
      metadata: row.metadata ?? existing?.metadata ?? {},
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: existing ? new Date().toISOString() : null,
    } satisfies ItemPriceRow;
  }

  return {
    async findBarcode(houseId, barcode) {
      for (const row of barcodes.values()) {
        if (row.house_id === houseId && row.barcode === barcode) {
          return row;
        }
      }
      return null;
    },
    async findGlobalItem(barcode) {
      for (const row of globalItems.values()) {
        if (row.barcode === barcode) {
          return row;
        }
      }
      return null;
    },
    async upsertItem(payload) {
      const id = payload.id ?? generateId("item", idCounter++);
      const existing = payload.id ? items.get(payload.id) : undefined;
      const record = makeItemRow(payload, id, existing);
      items.set(id, record);
      return record;
    },
    async upsertUoms(rows) {
      const inserted: ItemUomRow[] = [];
      for (const row of rows) {
        const existing = Array.from(uoms.values()).find(
          (uom) => uom.item_id === row.item_id && uom.code === row.code,
        );
        const id = existing?.id ?? row.id ?? generateId("uom", idCounter++);
        const record = makeItemUomRow(row, id, existing);
        uoms.set(id, record);
        inserted.push(record);
      }
      return inserted;
    },
    async upsertBarcodes(rows) {
      const inserted: ItemBarcodeRow[] = [];
      for (const row of rows) {
        const existing = Array.from(barcodes.values()).find(
          (code) => code.house_id === row.house_id && code.barcode === row.barcode,
        );
        const id = existing?.id ?? row.id ?? generateId("barcode", idCounter++);
        const record: ItemBarcodeRow = {
          id,
          house_id: row.house_id,
          item_id: row.item_id,
          uom_id: row.uom_id ?? null,
          barcode: row.barcode,
          is_primary: row.is_primary ?? existing?.is_primary ?? false,
          created_at: existing?.created_at ?? new Date().toISOString(),
        };
        barcodes.set(id, record);
        inserted.push(record);
      }
      return inserted;
    },
    async upsertPrice(row) {
      const existing = Array.from(prices.values()).find(
        (price) =>
          price.item_id === row.item_id &&
          price.uom_id === (row.uom_id ?? null) &&
          (price.price_type ?? null) === (row.price_type ?? null) &&
          (price.tier_tag ?? null) === (row.tier_tag ?? null),
      );
      const id = existing?.id ?? row.id ?? generateId("price", idCounter++);
      const record = makeItemPriceRow(row, id, existing);
      prices.set(id, record);
      return record;
    },
    async listPrices(houseId, itemId) {
      void houseId;
      return Array.from(prices.values()).filter((price) => price.item_id === itemId);
    },
    async deletePrices(priceIds) {
      for (const id of priceIds) {
        prices.delete(id);
      }
    },
    async replacePriceTiers(houseId, priceId, tierRows) {
      for (const tier of Array.from(tiers.values())) {
        if (tier.item_price_id === priceId) {
          tiers.delete(tier.id);
        }
      }
      const inserted: ItemPriceTierRow[] = [];
      for (const row of tierRows) {
        const id = row.id ?? generateId("tier", idCounter++);
        const record: ItemPriceTierRow = {
          id,
          house_id: houseId,
          item_price_id: priceId,
          min_quantity: row.min_quantity ?? 1,
          unit_price: row.unit_price,
          created_at: new Date().toISOString(),
        };
        tiers.set(id, record);
        inserted.push(record);
      }
      return inserted;
    },
    async replaceRawInputs(houseId, finishedItemId, rows) {
      for (const existing of Array.from(rawInputs.values())) {
        if (existing.finished_item_id === finishedItemId) {
          rawInputs.delete(existing.id);
        }
      }
      const inserted: ItemRawInputRow[] = [];
      for (const row of rows) {
        const id = row.id ?? generateId("raw", idCounter++);
        const record: ItemRawInputRow = {
          id,
          house_id: houseId,
          finished_item_id: finishedItemId,
          raw_item_id: row.raw_item_id,
          input_uom_id: row.input_uom_id ?? null,
          output_uom_id: row.output_uom_id ?? null,
          quantity: row.quantity ?? 0,
          expected_yield: row.expected_yield ?? null,
          created_at: new Date().toISOString(),
        };
        rawInputs.set(id, record);
        inserted.push(record);
      }
      return inserted;
    },
    async replaceBundles(houseId, bundleParentId, rows) {
      for (const existing of Array.from(bundles.values())) {
        if (existing.bundle_parent_id === bundleParentId) {
          bundles.delete(existing.id);
        }
      }
      const inserted: ItemBundleRow[] = [];
      for (const row of rows) {
        const id = row.id ?? generateId("bundle", idCounter++);
        const record: ItemBundleRow = {
          id,
          house_id: houseId,
          bundle_parent_id: bundleParentId,
          child_item_id: row.child_item_id,
          child_uom_id: row.child_uom_id ?? null,
          quantity: row.quantity ?? 0,
          cost_strategy: row.cost_strategy ?? "proportional",
          created_at: new Date().toISOString(),
        };
        bundles.set(id, record);
        inserted.push(record);
      }
      return inserted;
    },
    async loadSnapshot(houseId, itemId) {
      const item = items.get(itemId);
      if (!item || item.house_id !== houseId) return null;
      const uomList = Array.from(uoms.values()).filter((uom) => uom.item_id === itemId);
      const barcodeList = Array.from(barcodes.values()).filter((code) => code.item_id === itemId);
      const priceList = Array.from(prices.values())
        .filter((price) => price.item_id === itemId)
        .map((price) => ({
          ...price,
          tiers: Array.from(tiers.values()).filter((tier) => tier.item_price_id === price.id),
        }));
      const rawList = Array.from(rawInputs.values()).filter((row) => row.finished_item_id === itemId);
      const bundleList = Array.from(bundles.values()).filter((row) => row.bundle_parent_id === itemId);
      return {
        item,
        uoms: uomList,
        barcodes: barcodeList,
        prices: priceList,
        rawInputs: rawList,
        bundles: bundleList,
      } satisfies ProductSnapshot;
    },
  } satisfies ProductRepository;
}

export const __productTesting = {
  createInMemoryProductRepository,
};
