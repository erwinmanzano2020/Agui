import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";
import { uniqueSlug } from "@/lib/slug";

export type ItemRecord = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemBarcodeRecord = {
  id: string;
  item_id: string;
  barcode: string;
  created_at: string;
};

export type HouseItemRecord = {
  id: string;
  house_id: string;
  item_id: string;
  sku: string | null;
  price_cents: number | null;
  price_currency: string;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
};

export type HouseInventoryItem = {
  house_item: HouseItemRecord;
  item: ItemRecord;
  barcodes: ItemBarcodeRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

function ensureTimestamp(value: unknown, message: string): string {
  const result = ensureString(value, message);
  if (!Number.isFinite(new Date(result).getTime())) {
    throw new Error(message);
  }
  return result;
}

export function parseItemRecord(input: unknown): ItemRecord {
  if (!isRecord(input)) {
    throw new Error("Item payload must be an object");
  }

  const id = ensureString(input.id, "Item payload missing id");
  const name = ensureString(input.name, "Item payload missing name");
  const created_at = ensureTimestamp(input.created_at, "Item payload missing created_at");
  const updated_at = ensureTimestamp(input.updated_at, "Item payload missing updated_at");
  const description = typeof input.description === "string" ? input.description : null;

  return {
    id,
    name,
    description,
    created_at,
    updated_at,
  } satisfies ItemRecord;
}

export function parseItemBarcodeRecord(input: unknown): ItemBarcodeRecord {
  if (!isRecord(input)) {
    throw new Error("Item barcode payload must be an object");
  }

  const id = ensureString(input.id, "Item barcode payload missing id");
  const item_id = ensureString(input.item_id ?? input.itemId, "Item barcode payload missing item_id");
  const barcode = ensureString(input.barcode, "Item barcode payload missing barcode");
  const created_at = ensureTimestamp(input.created_at, "Item barcode payload missing created_at");

  return {
    id,
    item_id,
    barcode,
    created_at,
  } satisfies ItemBarcodeRecord;
}

export function parseHouseItemRecord(input: unknown): HouseItemRecord {
  if (!isRecord(input)) {
    throw new Error("House item payload must be an object");
  }

  const id = ensureString(input.id, "House item payload missing id");
  const house_id = ensureString(input.house_id ?? input.houseId, "House item payload missing house_id");
  const item_id = ensureString(input.item_id ?? input.itemId, "House item payload missing item_id");
  const created_at = ensureTimestamp(input.created_at, "House item payload missing created_at");
  const updated_at = ensureTimestamp(input.updated_at, "House item payload missing updated_at");

  const skuValue = typeof input.sku === "string" ? input.sku.trim() : null;
  const priceCurrency = typeof input.price_currency === "string" ? input.price_currency : "USD";

  let priceCents: number | null = null;
  if (typeof input.price_cents === "number") {
    priceCents = Number.isFinite(input.price_cents) ? Math.trunc(input.price_cents) : null;
  }

  let stockQuantity = 0;
  if (typeof input.stock_quantity === "number" && Number.isFinite(input.stock_quantity)) {
    stockQuantity = Math.max(0, Math.trunc(input.stock_quantity));
  }

  return {
    id,
    house_id,
    item_id,
    sku: skuValue && skuValue.length > 0 ? skuValue : null,
    price_cents: priceCents,
    price_currency: priceCurrency,
    stock_quantity: stockQuantity,
    created_at,
    updated_at,
  } satisfies HouseItemRecord;
}

export function parseHouseInventoryRow(input: unknown): HouseInventoryItem {
  if (!isRecord(input)) {
    throw new Error("House inventory payload must be an object");
  }

  const house_item = parseHouseItemRecord(input);
  const itemPayload = input.item ?? input.items;
  if (!itemPayload) {
    throw new Error("House inventory payload missing item relation");
  }

  const item = parseItemRecord(itemPayload);
  const barcodePayload = isRecord(itemPayload) ? itemPayload.barcodes : null;
  const barcodes: ItemBarcodeRecord[] = Array.isArray(barcodePayload)
    ? barcodePayload.map(parseItemBarcodeRecord)
    : [];

  return { house_item, item, barcodes } satisfies HouseInventoryItem;
}

export async function findItemByBarcode(code: string, supabase?: SupabaseClient | null) {
  const db = supabase ?? getSupabase(); if (!db) return null;
  const { data: row } = await db
    .from("item_barcodes")
    .select("item_id")
    .eq("barcode", code)
    .maybeSingle();
  if (!row?.item_id) return null;
  const { data: item } = await db.from("items").select("*").eq("id", row.item_id).maybeSingle();
  return item ?? null;
}

export type EnsureGlobalItemOptions = {
  supabase?: SupabaseClient | null;
  nameHint?: string;
  brand?: string;
  category?: string;
};

export async function ensureGlobalItemFromBarcode(code: string, opts: EnsureGlobalItemOptions = {}) {
  const db = opts.supabase ?? getSupabase(); if (!db) throw new Error("DB unavailable");
  const found = await findItemByBarcode(code, db);
  if (found) return found;

  const baseName = opts.nameHint?.trim() || `Unknown ${code.slice(-6)}`;
  const slug = await uniqueSlug(baseName, {
    async isAvailable(candidate) {
      const { data, error } = await db.from("items").select("id").eq("slug", candidate).limit(1);
      if (error) {
        return true;
      }
      return !data || data.length === 0;
    },
  });
  const { data: item, error: e1 } = await db
    .from("items")
    .insert({ name: baseName, slug, brand: opts.brand ?? null, category: opts.category ?? null })
    .select("*")
    .single();
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await db
    .from("item_barcodes")
    .insert({ item_id: item.id, barcode: code, is_primary: true });
  if (e2) throw new Error(e2.message);
  return item;
}

export type AdoptIntoHouseOptions = {
  supabase?: SupabaseClient | null;
  houseId: string;
  itemId: string;
  priceCentavos?: number;
  sku?: string;
};

export async function adoptIntoHouse({
  supabase,
  houseId,
  itemId,
  priceCentavos = 0,
  sku,
}: AdoptIntoHouseOptions) {
  const db = supabase ?? getSupabase(); if (!db) throw new Error("DB unavailable");
  const { data, error } = await db
    .from("house_items")
    .upsert(
      { house_id: houseId, item_id: itemId, price_centavos: priceCentavos, sku },
      { onConflict: "house_id,item_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
