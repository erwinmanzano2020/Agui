// src/lib/roles/get-capabilities.server.ts
import { createServerSupabase } from "@/lib/auth/server";
import type { BrandLite, UserCapabilities } from "@/lib/types/brand-lite";

type ViewRow = {
  brand_id?: unknown;
  brand_slug?: unknown;
  brand_name?: unknown;
};

function mapRows(rows: readonly ViewRow[] | null | undefined): BrandLite[] {
  if (!rows) return [];

  return rows
    .map((row) => {
      const { brand_id: id, brand_slug: slug, brand_name: name } = row;

      if (id == null || slug == null || name == null) {
        return null;
      }

      return {
        id: String(id),
        slug: String(slug),
        name: String(name),
      } satisfies BrandLite;
    })
    .filter((row): row is BrandLite => row !== null);
}

export async function getCapabilitiesForUser(userId: string): Promise<UserCapabilities> {
  const supabase = await createServerSupabase();

  const [loyalty, employee, owner, profile] = await Promise.all([
    supabase.from("v_loyalty_memberships").select("*").eq("user_id", userId),
    supabase.from("v_employee_roster").select("*").eq("user_id", userId),
    supabase.from("v_brand_owners").select("*").eq("user_id", userId),
    supabase.from("profiles").select("is_gm").eq("id", userId).maybeSingle(),
  ]);

  const responses = [
    { response: loyalty, context: "loyalty memberships" },
    { response: employee, context: "employee roster" },
    { response: owner, context: "brand ownership" },
    { response: profile, context: "profile" },
  ];

  for (const { response, context } of responses) {
    if (response.error) {
      throw new Error(`Failed to load ${context}: ${response.error.message}`);
    }
  }

  const loyaltyBrands = mapRows(loyalty.data);
  const employeeBrands = mapRows(employee.data);
  const ownerBrands = mapRows(owner.data);
  const profileData = profile.data as ({ is_gm: boolean | null } | null | undefined);
  const isGM = Boolean(profileData?.is_gm);

  return { isGM, loyaltyBrands, employeeBrands, ownerBrands };
}
