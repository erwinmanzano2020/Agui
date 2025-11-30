import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  ItemBundleRow,
  ItemRawInputRow,
  ItemRow,
  ItemUomRow,
  PosSaleLineRow,
  PosSaleRow,
  StockMovementInsert,
  StockMovementRow,
} from "@/lib/db.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const MOVEMENT_TYPE_POS_SALE = "POS_SALE" as const;

export type InventoryCatalogRepository = {
  listItems(houseId: string, itemIds: string[]): Promise<ItemRow[]>;
  listUoms(houseId: string, itemIds: string[]): Promise<ItemUomRow[]>;
  listBundles(houseId: string, bundleParentIds: string[]): Promise<ItemBundleRow[]>;
  listRawInputs(houseId: string, finishedIds: string[]): Promise<ItemRawInputRow[]>;
};

export type StockMovementRepository = {
  recordMovements(movements: StockMovementInsert[]): Promise<void>;
  getItemBalances?(houseId: string, itemIds: string[]): Promise<Map<string, number>>;
};

export type InventoryPostingDependencies = {
  catalog: InventoryCatalogRepository;
  movements: StockMovementRepository;
};

type UomMap = Map<string, ItemUomRow>;
type BaseUomMap = Map<string, ItemUomRow>;
type ItemMap = Map<string, ItemRow>;
type BundleMap = Map<string, ItemBundleRow[]>;
type RawInputMap = Map<string, ItemRawInputRow[]>;

function ensureNumber(value: number | string): number {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function toBaseQuantity(itemId: string, uomId: string | null, quantity: number, uoms: UomMap, baseUoms: BaseUomMap) {
  const factor = uomId ? uoms.get(uomId)?.factor_to_base ?? 1 : baseUoms.get(itemId)?.factor_to_base ?? 1;
  return ensureNumber(quantity) * ensureNumber(factor);
}

function groupBundles(entries: ItemBundleRow[]): BundleMap {
  return entries.reduce<BundleMap>((map, bundle) => {
    const existing = map.get(bundle.bundle_parent_id) ?? [];
    existing.push(bundle);
    map.set(bundle.bundle_parent_id, existing);
    return map;
  }, new Map());
}

function groupRawInputs(entries: ItemRawInputRow[]): RawInputMap {
  return entries.reduce<RawInputMap>((map, entry) => {
    const existing = map.get(entry.finished_item_id) ?? [];
    existing.push(entry);
    map.set(entry.finished_item_id, existing);
    return map;
  }, new Map());
}

function buildItemMap(entries: ItemRow[]): ItemMap {
  return new Map(entries.map((row) => [row.id, row]));
}

function buildUomMaps(entries: ItemUomRow[]): { uoms: UomMap; baseUoms: BaseUomMap } {
  const uoms = new Map<string, ItemUomRow>();
  const baseUoms = new Map<string, ItemUomRow>();

  for (const uom of entries) {
    uoms.set(uom.id, uom);
    if (uom.is_base) {
      baseUoms.set(uom.item_id, uom);
    }
  }

  return { uoms, baseUoms };
}

function movementKey(movement: StockMovementInsert) {
  const saleLinePart = movement.sale_line_id ?? "";
  return `${saleLinePart}|${movement.item_id}|${movement.movement_type}`;
}

export async function applyInventoryForSale(
  sale: PosSaleRow,
  lines: PosSaleLineRow[],
  deps: InventoryPostingDependencies,
): Promise<void> {
  if (lines.length === 0) return;

  const houseId = sale.house_id;
  const saleItemIds = Array.from(new Set(lines.map((line) => line.item_id)));

  const bundles = await deps.catalog.listBundles(houseId, saleItemIds);
  const rawInputs = await deps.catalog.listRawInputs(houseId, saleItemIds);
  const groupedBundles = groupBundles(bundles);
  const groupedRaw = groupRawInputs(rawInputs);

  const componentItemIds = new Set<string>();
  bundles.forEach((bundle) => componentItemIds.add(bundle.child_item_id));
  rawInputs.forEach((entry) => componentItemIds.add(entry.raw_item_id));

  const allItemIds = Array.from(new Set([...saleItemIds, ...componentItemIds]));
  const [items, uoms] = await Promise.all([
    deps.catalog.listItems(houseId, allItemIds),
    deps.catalog.listUoms(houseId, allItemIds),
  ]);
  const itemById = buildItemMap(items);
  const { uoms: uomById, baseUoms } = buildUomMaps(uoms);

  const movements: StockMovementInsert[] = [];
  const perLineItemTotals = new Map<string, StockMovementInsert>();

  for (const line of lines) {
    const lineBundles = groupedBundles.get(line.item_id) ?? [];
    const lineRawInputs = groupedRaw.get(line.item_id) ?? [];
    const parentBaseQuantity = toBaseQuantity(line.item_id, line.uom_id, ensureNumber(line.quantity), uomById, baseUoms);
    const parentBaseUomId = baseUoms.get(line.item_id)?.id ?? null;
    const parentTrackInventory = itemById.get(line.item_id)?.track_inventory ?? false;

    if (lineBundles.length > 0) {
      for (const component of lineBundles) {
        const childFactor = component.child_uom_id
          ? ensureNumber(uomById.get(component.child_uom_id)?.factor_to_base ?? 1)
          : 1;
        const baseQuantity = ensureNumber(parentBaseQuantity) * ensureNumber(component.quantity) * childFactor;

        const key = `${line.id}|${component.child_item_id}|${MOVEMENT_TYPE_POS_SALE}`;
        const existing = perLineItemTotals.get(key);
        const baseUomId = baseUoms.get(component.child_item_id)?.id ?? null;
        const quantityDelta = -baseQuantity;
        if (existing) {
          existing.quantity_delta += quantityDelta;
        } else {
          perLineItemTotals.set(key, {
            house_id: houseId,
            item_id: component.child_item_id,
            uom_id: baseUomId,
            quantity_delta: quantityDelta,
            movement_type: MOVEMENT_TYPE_POS_SALE,
            sale_id: sale.id,
            sale_line_id: line.id,
          });
        }
      }
      // TODO: Support deducting tracked bundle parents when inventory rules require it.
      continue;
    }

    if (lineRawInputs.length > 0) {
      for (const raw of lineRawInputs) {
        const inputFactor = raw.input_uom_id
          ? ensureNumber(uomById.get(raw.input_uom_id)?.factor_to_base ?? 1)
          : 1;
        const baseQuantity = ensureNumber(parentBaseQuantity) * ensureNumber(raw.quantity) * inputFactor;
        const baseUomId = baseUoms.get(raw.raw_item_id)?.id ?? null;
        const key = `${line.id}|${raw.raw_item_id}|${MOVEMENT_TYPE_POS_SALE}`;
        const quantityDelta = -baseQuantity;
        const existing = perLineItemTotals.get(key);
        if (existing) {
          existing.quantity_delta += quantityDelta;
        } else {
          perLineItemTotals.set(key, {
            house_id: houseId,
            item_id: raw.raw_item_id,
            uom_id: baseUomId,
            quantity_delta: quantityDelta,
            movement_type: MOVEMENT_TYPE_POS_SALE,
            sale_id: sale.id,
            sale_line_id: line.id,
          });
        }
      }

      if (!parentTrackInventory) {
        continue;
      }
    }

    const key = `${line.id}|${line.item_id}|${MOVEMENT_TYPE_POS_SALE}`;
    const existing = perLineItemTotals.get(key);
    const quantityDelta = -parentBaseQuantity;
    if (existing) {
      existing.quantity_delta += quantityDelta;
    } else {
      perLineItemTotals.set(key, {
        house_id: houseId,
        item_id: line.item_id,
        uom_id: parentBaseUomId,
        quantity_delta: quantityDelta,
        movement_type: MOVEMENT_TYPE_POS_SALE,
        sale_id: sale.id,
        sale_line_id: line.id,
      });
    }
  }

  movements.push(...perLineItemTotals.values());

  const itemIds = Array.from(new Set(movements.map((movement) => movement.item_id)));
  const balances =
    typeof deps.movements.getItemBalances === "function"
      ? await deps.movements.getItemBalances(houseId, itemIds)
      : new Map<string, number>();

  const runningBalances = new Map<string, number>(balances);
  const movementsWithFlags = movements.map((movement) => {
    const currentBalance = runningBalances.get(movement.item_id) ?? 0;
    const nextBalance = currentBalance + ensureNumber(movement.quantity_delta);
    const isOverdrawn = nextBalance < 0;
    runningBalances.set(movement.item_id, nextBalance);
    return { ...movement, is_overdrawn: movement.is_overdrawn ?? isOverdrawn };
  });

  const uniqueMovements = new Map<string, StockMovementInsert>();
  for (const movement of movementsWithFlags) {
    const key = movementKey(movement);
    if (uniqueMovements.has(key)) continue;
    uniqueMovements.set(key, movement);
  }

  await deps.movements.recordMovements([...uniqueMovements.values()]);
}

function resolveSupabaseClient(explicit?: SupabaseClient<Database> | null) {
  return explicit ?? createServiceSupabaseClient<Database>();
}

export function createSupabaseInventoryCatalogRepository(
  client?: SupabaseClient<Database> | null,
): InventoryCatalogRepository {
  const supabase = resolveSupabaseClient(client);

  return {
    async listItems(houseId, itemIds) {
      if (itemIds.length === 0) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("house_id", houseId)
        .in("id", itemIds);
      if (error) throw new Error(error.message);
      return (data as ItemRow[]) ?? [];
    },
    async listUoms(houseId, itemIds) {
      if (itemIds.length === 0) return [];
      const { data, error } = await supabase
        .from("item_uoms")
        .select("*")
        .eq("house_id", houseId)
        .in("item_id", itemIds);
      if (error) throw new Error(error.message);
      return (data as ItemUomRow[]) ?? [];
    },
    async listBundles(houseId, bundleParentIds) {
      if (bundleParentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("item_bundles")
        .select("*")
        .eq("house_id", houseId)
        .in("bundle_parent_id", bundleParentIds);
      if (error) throw new Error(error.message);
      return (data as ItemBundleRow[]) ?? [];
    },
    async listRawInputs(houseId, finishedIds) {
      if (finishedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("item_raw_inputs")
        .select("*")
        .eq("house_id", houseId)
        .in("finished_item_id", finishedIds);
      if (error) throw new Error(error.message);
      return (data as ItemRawInputRow[]) ?? [];
    },
  } satisfies InventoryCatalogRepository;
}

export function createSupabaseStockMovementRepository(
  client?: SupabaseClient<Database> | null,
): StockMovementRepository {
  const supabase = resolveSupabaseClient(client);

  return {
    async recordMovements(movements) {
      if (movements.length === 0) return;
      const { error } = await supabase
        .from("stock_movements")
        .upsert(movements, { onConflict: "sale_line_id,item_id,movement_type" });
      if (error) throw new Error(error.message);
    },
    async getItemBalances(houseId, itemIds) {
      if (itemIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from("stock_movements")
        .select("item_id, quantity_delta")
        .eq("house_id", houseId)
        .in("item_id", itemIds);
      if (error) throw new Error(error.message);
      const balances = new Map<string, number>();
      for (const row of (data as Pick<StockMovementRow, "item_id" | "quantity_delta">[]) ?? []) {
        const current = balances.get(row.item_id) ?? 0;
        balances.set(row.item_id, current + ensureNumber(row.quantity_delta));
      }
      return balances;
    },
  } satisfies StockMovementRepository;
}

export function createInMemoryInventoryCatalogRepository(initial?: Partial<{
  items: ItemRow[];
  uoms: ItemUomRow[];
  bundles: ItemBundleRow[];
  rawInputs: ItemRawInputRow[];
}>): InventoryCatalogRepository & {
  items: ItemRow[];
  uoms: ItemUomRow[];
  bundles: ItemBundleRow[];
  rawInputs: ItemRawInputRow[];
} {
  const items = [...(initial?.items ?? [])];
  const uoms = [...(initial?.uoms ?? [])];
  const bundles = [...(initial?.bundles ?? [])];
  const rawInputs = [...(initial?.rawInputs ?? [])];

  return {
    items,
    uoms,
    bundles,
    rawInputs,
    async listItems(houseId, itemIds) {
      return items.filter((row) => row.house_id === houseId && itemIds.includes(row.id));
    },
    async listUoms(houseId, itemIds) {
      return uoms.filter((row) => row.house_id === houseId && itemIds.includes(row.item_id));
    },
    async listBundles(houseId, bundleParentIds) {
      return bundles.filter((row) => row.house_id === houseId && bundleParentIds.includes(row.bundle_parent_id));
    },
    async listRawInputs(houseId, finishedIds) {
      return rawInputs.filter((row) => row.house_id === houseId && finishedIds.includes(row.finished_item_id));
    },
  };
}

export function createInMemoryStockMovementRepository(initial?: Partial<{ movements: StockMovementRow[] }>):
  StockMovementRepository & { movements: StockMovementRow[] } {
  const movements = [...(initial?.movements ?? [])];
  let counter = 1;

  return {
    movements,
    async recordMovements(pending) {
      for (const entry of pending) {
        const key = movementKey(entry);
        const duplicate = movements.find(
          (row) => `${row.sale_line_id ?? ""}|${row.item_id}|${row.movement_type}` === key,
        );
        if (duplicate) continue;

        movements.push({
          id: entry.id ?? `movement-${counter++}`,
          house_id: entry.house_id,
          branch_id: entry.branch_id ?? null,
          item_id: entry.item_id,
          uom_id: entry.uom_id ?? null,
          quantity_delta: entry.quantity_delta,
          movement_type: entry.movement_type,
          sale_id: entry.sale_id ?? null,
          sale_line_id: entry.sale_line_id ?? null,
          is_overdrawn: entry.is_overdrawn ?? false,
          created_at: entry.created_at ?? new Date().toISOString(),
        });
      }
    },
    async getItemBalances(houseId, itemIds) {
      const balances = new Map<string, number>();
      for (const movement of movements.filter((row) => row.house_id === houseId && itemIds.includes(row.item_id))) {
        const current = balances.get(movement.item_id) ?? 0;
        balances.set(movement.item_id, current + ensureNumber(movement.quantity_delta));
      }
      return balances;
    },
  };
}
