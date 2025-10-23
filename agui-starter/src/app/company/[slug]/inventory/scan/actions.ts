"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentEntity } from "@/lib/auth/entity";
import {
  adoptItemByBarcode,
  loadHouseInventory,
  updateHouseItemDetails,
} from "@/lib/inventory/items-server";
import { getSupabase } from "@/lib/supabase";
import { loadHouseBySlug } from "@/lib/taxonomy/houses-server";

import { mapInventoryItems, type InventoryScanState } from "./state";

function coerceString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceNullableString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePriceInput(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid price with up to two decimal places.");
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Price must be a positive amount.");
  }
  return Math.round(parsed * 100);
}

function parseStockInput(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Stock must be a whole number.");
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Stock can’t be negative.");
  }
  return parsed;
}

async function ensureInventoryAccess(
  supabase: SupabaseClient,
  houseId: string,
  guildId: string | null,
  entityId: string,
) {
  const [houseRoleResult, guildRoleResult] = await Promise.all([
    supabase
      .from("house_roles")
      .select("id")
      .eq("house_id", houseId)
      .eq("entity_id", entityId)
      .maybeSingle(),
    guildId
      ? supabase
          .from("guild_roles")
          .select("id")
          .eq("guild_id", guildId)
          .eq("entity_id", entityId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (houseRoleResult.error) {
    throw new Error(`Failed to verify house role: ${houseRoleResult.error.message}`);
  }

  if (guildRoleResult.error) {
    throw new Error(`Failed to verify guild role: ${guildRoleResult.error.message}`);
  }

  const hasHouseRole = Boolean(houseRoleResult.data);
  const hasGuildRole = Boolean(guildRoleResult.data);
  return hasHouseRole || hasGuildRole;
}

export async function handleInventoryAction(
  prevState: InventoryScanState,
  formData: FormData,
): Promise<InventoryScanState> {
  const mode = coerceString(formData.get("mode")) ?? "scan";
  if (mode === "reset") {
    return {
      ...prevState,
      status: "idle",
      message: null,
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  const slug = coerceString(formData.get("slug"));
  if (!slug) {
    return {
      ...prevState,
      status: "error",
      message: "Missing company context. Reload and try again.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  let supabase: SupabaseClient | null;
  try {
    supabase = getSupabase();
  } catch (error) {
    console.error("Supabase not configured while handling inventory action", error);
    return {
      ...prevState,
      status: "error",
      message: "Inventory tools require Supabase to be configured.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  if (!supabase) {
    return {
      ...prevState,
      status: "error",
      message: "Inventory tools require Supabase to be configured.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  const house = await loadHouseBySlug(supabase, slug).catch((error) => {
    console.error("Failed to load house for inventory action", error);
    return null;
  });

  if (!house) {
    return {
      ...prevState,
      status: "error",
      message: "We couldn’t find that company. Confirm the link and try again.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  const actor = await getCurrentEntity({ supabase }).catch((error) => {
    console.warn("Failed to resolve current entity for inventory action", error);
    return null;
  });

  if (!actor) {
    return {
      ...prevState,
      status: "error",
      message: "Sign in to manage inventory.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  let hasAccess = false;
  try {
    hasAccess = await ensureInventoryAccess(supabase, house.id, house.guild_id ?? null, actor.id);
  } catch (error) {
    console.error("Failed to verify inventory access", error);
    return {
      ...prevState,
      status: "error",
      message: "We couldn’t verify your access for this company yet.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  if (!hasAccess) {
    return {
      ...prevState,
      status: "error",
      message: "Only house or guild staff can manage inventory here.",
      highlightHouseItemId: null,
    } satisfies InventoryScanState;
  }

  if (mode === "scan") {
    const barcode = coerceString(formData.get("barcode"));
    if (!barcode) {
      return {
        ...prevState,
        status: "error",
        message: "Scan a barcode before adopting it.",
        highlightHouseItemId: null,
      } satisfies InventoryScanState;
    }

    try {
      const result = await adoptItemByBarcode({ supabase, houseId: house.id, barcode });
      const inventory = await loadHouseInventory(supabase, house.id);
      const items = mapInventoryItems(inventory);
      const message = result.createdHouseItem
        ? "Item adopted into this inventory. Update the details below."
        : "This barcode was already adopted here. Inventory refreshed.";

      return {
        status: "success",
        message,
        items,
        highlightHouseItemId: result.inventoryItem.house_item.id,
      } satisfies InventoryScanState;
    } catch (error) {
      console.error("Failed to adopt inventory item", error);
      return {
        ...prevState,
        status: "error",
        message: error instanceof Error ? error.message : "We couldn’t adopt that barcode just yet.",
        highlightHouseItemId: null,
      } satisfies InventoryScanState;
    }
  }

  if (mode === "update") {
    const houseItemId = coerceString(formData.get("house_item_id"));
    if (!houseItemId) {
      return {
        ...prevState,
        status: "error",
        message: "We couldn’t identify which inventory row to update.",
        highlightHouseItemId: null,
      } satisfies InventoryScanState;
    }

    let priceCents: number | null = null;
    try {
      priceCents = parsePriceInput(formData.get("price"));
    } catch (error) {
      return {
        ...prevState,
        status: "error",
        message: error instanceof Error ? error.message : "Enter a valid price before saving.",
        highlightHouseItemId: houseItemId,
      } satisfies InventoryScanState;
    }

    let stockQuantity: number;
    try {
      stockQuantity = parseStockInput(formData.get("stock"));
    } catch (error) {
      return {
        ...prevState,
        status: "error",
        message: error instanceof Error ? error.message : "Enter a valid stock level before saving.",
        highlightHouseItemId: houseItemId,
      } satisfies InventoryScanState;
    }

    const sku = coerceNullableString(formData.get("sku"));

    try {
      await updateHouseItemDetails({
        supabase,
        houseId: house.id,
        houseItemId,
        sku,
        priceCents,
        stockQuantity,
      });
      const inventory = await loadHouseInventory(supabase, house.id);
      const items = mapInventoryItems(inventory);

      return {
        status: "success",
        message: "Inventory details saved.",
        items,
        highlightHouseItemId: houseItemId,
      } satisfies InventoryScanState;
    } catch (error) {
      console.error("Failed to update inventory row", error);
      return {
        ...prevState,
        status: "error",
        message: error instanceof Error ? error.message : "We couldn’t save those changes yet.",
        highlightHouseItemId: houseItemId,
      } satisfies InventoryScanState;
    }
  }

  return {
    ...prevState,
    status: "error",
    message: "Unsupported inventory action.",
    highlightHouseItemId: null,
  } satisfies InventoryScanState;
}
