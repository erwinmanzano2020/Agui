// src/lib/roles/capabilities.ts
import { getServerSupabase } from "@/lib/auth/server";
import type { PostgrestResponse } from "@supabase/supabase-js";

export type BrandRef = { id: string; slug: string; name: string };
export type Capabilities = {
  isGM: boolean;
  loyaltyBrands: BrandRef[];
  employeeOf: BrandRef[];
  ownerOf: BrandRef[];
  gmApps: boolean;
};

const GM_EMAILS = (process.env.AGHI_GM_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// The shape we select with:  brand: brands(id,slug,name)
type BrandCell = { id: string | number; slug: string; name: string };
type RowWithBrand = { brand?: BrandCell | BrandCell[] | null };

type BrandQuery = PostgrestResponse<RowWithBrand>;

/** Map a selected brand record to a BrandRef (stringify ids). */
function toBrandRef(b: BrandCell): BrandRef {
  return { id: String(b.id), slug: String(b.slug), name: String(b.name) };
}

/** Supabase may return `brand` as object or array; normalize to a flat list. */
function rowsToBrandRefs(rows: ReadonlyArray<RowWithBrand> | null | undefined): BrandRef[] {
  if (!rows) return [];
  const out: BrandRef[] = [];
  for (const r of rows) {
    const cell = r.brand;
    if (!cell) continue;
    if (Array.isArray(cell)) {
      for (const b of cell) {
        out.push(toBrandRef(b));
      }
    } else {
      out.push(toBrandRef(cell));
    }
  }
  return out;
}

export async function getCapabilities(userId: string, email?: string): Promise<Capabilities> {
  const supabase = await getServerSupabase();

  const [loyaltyQ, employeeQ, ownerQ]: BrandQuery[] = await Promise.all([
    supabase.from("loyalty_memberships").select("brand:brands(id,slug,name)").eq("user_id", userId),
    supabase
      .from("employee_memberships")
      .select("brand:brands(id,slug,name)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("owner_memberships").select("brand:brands(id,slug,name)").eq("user_id", userId),
  ]);

  const loyaltyBrands = rowsToBrandRefs(loyaltyQ.data);
  const employeeOf = rowsToBrandRefs(employeeQ.data);
  const ownerOf = rowsToBrandRefs(ownerQ.data);

  const isGM = !!email && GM_EMAILS.includes(email.toLowerCase());

  return { isGM, loyaltyBrands, employeeOf, ownerOf, gmApps: isGM };
}
