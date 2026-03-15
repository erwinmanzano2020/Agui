import type { HouseInventoryItem } from "@/lib/inventory/items";

export type InventoryItemState = {
  houseItemId: string;
  houseId: string;
  itemId: string;
  itemName: string;
  itemDescription: string | null;
  barcodes: string[];
  sku: string | null;
  priceCents: number | null;
  priceCurrency: string;
  stockQuantity: number;
  createdAt: string;
  updatedAt: string;
  itemCreatedAt: string;
  itemUpdatedAt: string;
};

export type InventoryScanState = {
  status: "idle" | "success" | "error";
  message: string | null;
  items: InventoryItemState[];
  highlightHouseItemId: string | null;
};

export const INITIAL_INVENTORY_SCAN_STATE: InventoryScanState = {
  status: "idle",
  message: null,
  items: [],
  highlightHouseItemId: null,
};

function normalizeBarcodes(barcodes: string[]): string[] {
  return [...new Set(barcodes.map((code) => code.trim()).filter((code) => code.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function toInventoryItemState(item: HouseInventoryItem): InventoryItemState {
  const barcodeValues = normalizeBarcodes(item.barcodes.map((entry) => entry.barcode));

  return {
    houseItemId: item.house_item.id,
    houseId: item.house_item.house_id,
    itemId: item.item.id,
    itemName: item.item.name,
    itemDescription: item.item.description ?? null,
    barcodes: barcodeValues,
    sku: item.house_item.sku,
    priceCents: typeof item.house_item.price_cents === "number" ? item.house_item.price_cents : null,
    priceCurrency: item.house_item.price_currency,
    stockQuantity: item.house_item.stock_quantity,
    createdAt: item.house_item.created_at,
    updatedAt: item.house_item.updated_at,
    itemCreatedAt: item.item.created_at,
    itemUpdatedAt: item.item.updated_at,
  } satisfies InventoryItemState;
}

export function mapInventoryItems(items: HouseInventoryItem[]): InventoryItemState[] {
  return items.map(toInventoryItemState);
}
