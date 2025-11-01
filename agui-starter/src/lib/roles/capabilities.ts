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
  .map((s) => s.trim())
  .filter(Boolean);

type BrandRow = {
  brand: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

const isBrand = (brand: BrandRow["brand"]): brand is NonNullable<BrandRow["brand"]> =>
  Boolean(brand);

export async function getCapabilities(userId: string, email?: string): Promise<Capabilities> {
  const supabase = await getServerSupabase();

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

  const toBrandRefs = (rows?: BrandRow[] | null): BrandRef[] =>
    (rows ?? [])
      .map((r) => r.brand)
      .filter(isBrand)
      .map((b) => ({ id: b.id, slug: b.slug, name: b.name }));

  const loyaltyBrands = toBrandRefs(loyaltyQ.data);
  const employeeOf = toBrandRefs(employeeQ.data);
  const ownerOf = toBrandRefs(ownerQ.data);

  const isGM = !!email && GM_EMAILS.includes(email.toLowerCase());
  return {
    isGM,
    loyaltyBrands,
    employeeOf,
    ownerOf,
    gmApps: isGM,
  };
}
