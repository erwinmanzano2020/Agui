import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";

import { parseHouseInventoryRow, parseItemRecord, type HouseInventoryItem } from "./items";

const UNIQUE_VIOLATION = "23505";

function resolveSupabaseClient(explicit?: SupabaseClient): SupabaseClient {
  if (explicit) return explicit;
  const client = getSupabase();
  if (!client) {
    throw new Error(
      "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return client;
}

async function fetchHouseInventoryItem(
  client: SupabaseClient,
  houseId: string,
  itemId: string,
): Promise<HouseInventoryItem | null> {
  const { data, error } = await client
    .from("house_items")
    .select("*, item:items(*, barcodes:item_barcodes(*))")
    .eq("house_id", houseId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load house inventory item: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return parseHouseInventoryRow(data);
}

export async function loadHouseInventory(
  supabase: SupabaseClient,
  houseId: string,
): Promise<HouseInventoryItem[]> {
  const { data, error } = await supabase
    .from("house_items")
    .select("*, item:items(*, barcodes:item_barcodes(*))")
    .eq("house_id", houseId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load house inventory: ${error.message}`);
  }

  const rows = data ?? [];
  return rows.map(parseHouseInventoryRow);
}

export type AdoptItemByBarcodeOptions = {
  supabase?: SupabaseClient;
  houseId: string;
  barcode: string;
  placeholderName?: string;
};

export type AdoptItemByBarcodeResult = {
  inventoryItem: HouseInventoryItem;
  createdItem: boolean;
  createdBarcode: boolean;
  createdHouseItem: boolean;
};

export async function adoptItemByBarcode({
  supabase: explicit,
  houseId,
  barcode,
  placeholderName,
}: AdoptItemByBarcodeOptions): Promise<AdoptItemByBarcodeResult> {
  const client = resolveSupabaseClient(explicit);
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) {
    throw new Error("Scan a barcode before adopting it.");
  }

  let itemId: string | null = null;
  let createdItem = false;
  let createdBarcode = false;
  let placeholderItemId: string | null = null;

  const { data: existingBarcode, error: barcodeLookupError } = await client
    .from("item_barcodes")
    .select("id, barcode, item_id, item:items(*)")
    .eq("barcode", normalizedBarcode)
    .maybeSingle();

  if (barcodeLookupError) {
    throw new Error(`Failed to look up barcode: ${barcodeLookupError.message}`);
  }

  if (existingBarcode) {
    if (!existingBarcode.item) {
      throw new Error("Barcode record is missing linked item");
    }
    const item = parseItemRecord(existingBarcode.item);
    itemId = item.id;
  } else {
    const name = placeholderName?.trim() || "Pending item";
    const { data: insertedItem, error: itemInsertError } = await client
      .from("items")
      .insert({ name })
      .select("*")
      .single();

    if (itemInsertError) {
      throw new Error(`Failed to create placeholder item: ${itemInsertError.message}`);
    }

    const item = parseItemRecord(insertedItem);
    itemId = item.id;
    placeholderItemId = item.id;
    createdItem = true;

    const { error: barcodeInsertError } = await client
      .from("item_barcodes")
      .insert({ item_id: item.id, barcode: normalizedBarcode });

    if (barcodeInsertError) {
      if (barcodeInsertError.code === UNIQUE_VIOLATION) {
        createdItem = false;
        placeholderItemId = item.id;
        const { data: existingAfterConflict, error: conflictLookupError } = await client
          .from("item_barcodes")
          .select("item_id")
          .eq("barcode", normalizedBarcode)
          .maybeSingle();

        if (conflictLookupError) {
          throw new Error(`Failed to resolve barcode conflict: ${conflictLookupError.message}`);
        }

        if (!existingAfterConflict?.item_id || typeof existingAfterConflict.item_id !== "string") {
          throw new Error("Barcode conflict detected without a matching item");
        }

        itemId = existingAfterConflict.item_id;

        const { error: cleanupError } = await client.from("items").delete().eq("id", item.id);
        if (cleanupError) {
          console.warn("Failed to remove placeholder item after barcode conflict", cleanupError);
        } else {
          placeholderItemId = null;
        }
      } else {
        const { error: cleanupError } = await client.from("items").delete().eq("id", item.id);
        if (cleanupError) {
          console.warn("Failed to remove placeholder item after barcode insert failure", cleanupError);
        }
        throw new Error(`Failed to record barcode: ${barcodeInsertError.message}`);
      }
    } else {
      createdBarcode = true;
    }
  }

  if (!itemId) {
    throw new Error("We couldn’t resolve an item for that barcode.");
  }

  let createdHouseItem = false;
  const { data: existingHouseItem, error: houseItemLookupError } = await client
    .from("house_items")
    .select("id")
    .eq("house_id", houseId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (houseItemLookupError) {
    throw new Error(`Failed to check existing inventory: ${houseItemLookupError.message}`);
  }

  if (!existingHouseItem) {
    const { error: houseItemInsertError } = await client
      .from("house_items")
      .insert({ house_id: houseId, item_id: itemId });

    if (houseItemInsertError) {
      if (houseItemInsertError.code !== UNIQUE_VIOLATION) {
        throw new Error(`Failed to adopt item into house inventory: ${houseItemInsertError.message}`);
      }
    } else {
      createdHouseItem = true;
    }
  }

  const inventoryItem = await fetchHouseInventoryItem(client, houseId, itemId);
  if (!inventoryItem) {
    throw new Error("We adopted the item but couldn’t reload it. Try refreshing the page.");
  }

  if (placeholderItemId && placeholderItemId !== inventoryItem.item.id) {
    const { error: cleanupError } = await client.from("items").delete().eq("id", placeholderItemId);
    if (cleanupError) {
      console.warn("Failed to clean up unused placeholder item", cleanupError);
    }
  }

  return {
    inventoryItem,
    createdItem,
    createdBarcode,
    createdHouseItem,
  } satisfies AdoptItemByBarcodeResult;
}

export type UpdateHouseItemDetailsOptions = {
  supabase?: SupabaseClient;
  houseId: string;
  houseItemId: string;
  sku: string | null;
  priceCents: number | null;
  priceCurrency?: string | null;
  stockQuantity: number;
};

export async function updateHouseItemDetails({
  supabase: explicit,
  houseId,
  houseItemId,
  sku,
  priceCents,
  priceCurrency,
  stockQuantity,
}: UpdateHouseItemDetailsOptions): Promise<HouseInventoryItem> {
  const client = resolveSupabaseClient(explicit);

  const updates: {
    sku: string | null;
    price_cents: number | null;
    stock_quantity: number;
    price_currency?: string | null;
  } = {
    sku,
    price_cents: priceCents,
    stock_quantity: stockQuantity,
  };

  if (priceCurrency !== undefined) {
    updates.price_currency = priceCurrency;
  }

  const { data, error } = await client
    .from("house_items")
    .update(updates)
    .eq("id", houseItemId)
    .eq("house_id", houseId)
    .select("*, item:items(*, barcodes:item_barcodes(*))")
    .single();

  if (error) {
    throw new Error(`Failed to update inventory details: ${error.message}`);
  }

  return parseHouseInventoryRow(data);
}
