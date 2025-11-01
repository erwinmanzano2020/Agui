// src/lib/roles/capabilities.ts
import { getServerSupabase } from "@/lib/auth/server";

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

/** Map any brand-like record to a BrandRef (defensive casting). */
function toBrandRef(b: any): BrandRef {
  if (!b) throw new Error("Invalid brand");
  return {
    id: String(b.id),
    slug: String(b.slug),
    name: String(b.name),
  };
}

/** Supabase may return `brand` as an object or an array; normalize to a flat list. */
function rowsToBrandRefs(rows: any[] | null | undefined): BrandRef[] {
  if (!rows) return [];
  const out: BrandRef[] = [];
  for (const r of rows) {
    const cell = (r as any).brand;
    if (!cell) continue;
    if (Array.isArray(cell)) {
      for (const b of cell) out.push(toBrandRef(b));
    } else {
      out.push(toBrandRef(cell));
    }
  }
  return out;
}

export async function getCapabilities(
  userId: string,
  email?: string
): Promise<Capabilities> {
  const supabase = await getServerSupabase();

  // Adjust table names/columns to your schema if needed.
  const [loyaltyQ, employeeQ, ownerQ] = await Promise.all([
    supabase
      .from("loyalty_memberships")
      .select("brand:brands(id,slug,name)")
      .eq("user_id", userId),
    supabase
      .from("employee_memberships")
      .select("brand:brands(id,slug,name)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("owner_memberships")
      .select("brand:brands(id,slug,name)")
      .eq("user_id", userId),
  ]);

  const loyaltyBrands = rowsToBrandRefs(loyaltyQ.data);
  const employeeOf = rowsToBrandRefs(employeeQ.data);
  const ownerOf = rowsToBrandRefs(ownerQ.data);

  const isGM = !!email && GM_EMAILS.includes(email.toLowerCase());

  return {
    isGM,
    loyaltyBrands,
    employeeOf,
    ownerOf,
    gmApps: isGM,
  };
}
