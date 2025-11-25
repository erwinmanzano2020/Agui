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
  ItemUomInsert,
  ItemUomRow,
} from "@/lib/db.types";
import { getServiceSupabase } from "@/lib/supabase-service";

export type DatabaseClient = SupabaseClient<Database>;

export type ProductSnapshot = {
  item: ItemRow;
  uoms: ItemUomRow[];
  barcodes: ItemBarcodeRow[];
  prices: Array<ItemPriceRow & { tiers: ItemPriceTierRow[] }>;
};

export type ProductEncodingInput = {
  itemId?: string | null;
  name: string;
  shortName?: string | null;
  category?: string | null;
  brand?: string | null;
  isSellable?: boolean;
  isRawMaterial?: boolean;
  trackInventory?: boolean;
  baseUom: { code: string; name?: string | null };
  variants?: Array<{ code: string; name?: string | null; factorToBase: number }>;
  barcodes?: Array<{ code: string; uomCode?: string | null; isPrimary?: boolean }>;
  basePrice: number;
  priceCurrency?: string;
  priceTiers?: Array<{ minQuantity: number; unitPrice: number }>;
};

export type ProductRepository = {
  findBarcode(houseId: string, barcode: string): Promise<ItemBarcodeRow | null>;
  upsertItem(payload: ItemInsert): Promise<ItemRow>;
  upsertUoms(rows: ItemUomInsert[]): Promise<ItemUomRow[]>;
  upsertBarcodes(rows: ItemBarcodeInsert[]): Promise<ItemBarcodeRow[]>;
  upsertPrice(row: ItemPriceInsert): Promise<ItemPriceRow>;
  replacePriceTiers(
    houseId: string,
    priceId: string,
    tiers: ItemPriceTierInsert[],
  ): Promise<ItemPriceTierRow[]>;
  loadSnapshot(houseId: string, itemId: string): Promise<ProductSnapshot | null>;
};

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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
}): Promise<ProductSnapshot | null> {
  const normalized = normalizeString(barcode);
  if (!normalized) {
    throw new Error("Barcode is required for lookup");
  }
  const store = resolveRepository(repo, supabase);
  const match = await store.findBarcode(houseId, normalized);
  if (!match) return null;
  return store.loadSnapshot(houseId, match.item_id);
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
  const itemName = normalizeString(payload.name);
  if (!itemName) {
    throw new Error("Product name is required");
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
    name: itemName,
    short_name: normalizeString(payload.shortName),
    brand: normalizeString(payload.brand),
    category: normalizeString(payload.category),
    is_sellable: payload.isSellable ?? true,
    is_raw_material: payload.isRawMaterial ?? false,
    track_inventory: payload.trackInventory ?? false,
  });

  const uoms = await store.upsertUoms(normalizeUoms(houseId, item.id, payload.baseUom, payload.variants));
  const uomByCode = new Map(uoms.map((row) => [row.code, row]));
  const baseUom = uoms.find((uom) => uom.is_base) ?? uoms[0];

  const barcodes: ItemBarcodeInsert[] = [];
  for (const entry of payload.barcodes ?? []) {
    if (!entry) continue;
    const code = normalizeString(entry.code);
    if (!code) continue;
    const linkedUom = entry.uomCode ? uomByCode.get(entry.uomCode) : baseUom;
    barcodes.push({
      house_id: houseId,
      item_id: item.id,
      barcode: code,
      is_primary: entry.isPrimary ?? false,
      uom_id: linkedUom?.id ?? null,
    });
  }
  if (barcodes.length > 0) {
    await store.upsertBarcodes(barcodes);
  }

  const unitPrice = assertCentavos(payload.basePrice, "base price");
  const price = await store.upsertPrice({
    house_id: houseId,
    item_id: item.id,
    uom_id: baseUom?.id ?? null,
    unit_price: unitPrice,
    currency: payload.priceCurrency ?? "PHP",
  });

  const tiers = normalizePriceTiers(houseId, price.id, payload.priceTiers);
  await store.replacePriceTiers(houseId, price.id, tiers);

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

  const price = snapshot.prices.find((entry) => entry.uom_id === uomId) ?? snapshot.prices[0];
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
        .upsert(row, { onConflict: "item_id,uom_id" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ItemPriceRow;
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
    async loadSnapshot(houseId, itemId) {
      const { data: item, error: itemError } = await client
        .from("items")
        .select("*")
        .eq("house_id", houseId)
        .eq("id", itemId)
        .maybeSingle();
      if (itemError) throw new Error(itemError.message);
      if (!item) return null;

      const [uomsRes, barcodesRes, pricesRes] = await Promise.all([
        client.from("item_uoms").select("*").eq("item_id", itemId),
        client.from("item_barcodes").select("*").eq("item_id", itemId),
        client.from("item_prices").select("*").eq("item_id", itemId),
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
}>): ProductRepository {
  let idCounter = 1;
  const items = new Map(initial?.items?.map((row) => [row.id, row]) ?? []);
  const uoms = new Map(initial?.uoms?.map((row) => [row.id, row]) ?? []);
  const barcodes = new Map(initial?.barcodes?.map((row) => [row.id, row]) ?? []);
  const prices = new Map(initial?.prices?.map((row) => [row.id, row]) ?? []);
  const tiers = new Map(initial?.tiers?.map((row) => [row.id, row]) ?? []);

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
        (price) => price.item_id === row.item_id && price.uom_id === (row.uom_id ?? null),
      );
      const id = existing?.id ?? row.id ?? generateId("price", idCounter++);
      const record = makeItemPriceRow(row, id, existing);
      prices.set(id, record);
      return record;
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
      return { item, uoms: uomList, barcodes: barcodeList, prices: priceList } satisfies ProductSnapshot;
    },
  } satisfies ProductRepository;
}

export const __productTesting = {
  createInMemoryProductRepository,
};
