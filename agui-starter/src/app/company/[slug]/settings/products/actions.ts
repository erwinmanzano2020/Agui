"use server";

import { lookupProductByBarcode, upsertProductFromEncoding } from "@/lib/pos/products/server";
import type { ProductEncodingInput } from "@/lib/pos/products/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function lookupProductAction(input: { houseId: string; barcode: string }) {
  const supabase = createServiceSupabaseClient();
  return lookupProductByBarcode({ houseId: input.houseId, barcode: input.barcode, supabase });
}

export async function saveProductAction(input: { houseId: string; payload: ProductEncodingInput }) {
  const supabase = createServiceSupabaseClient();
  return upsertProductFromEncoding({ houseId: input.houseId, payload: input.payload, supabase });
}
