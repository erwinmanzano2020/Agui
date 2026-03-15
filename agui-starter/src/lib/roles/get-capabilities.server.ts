import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  BrandOwnerViewRow,
  EmployeeRosterViewRow,
  LoyaltyMembershipViewRow,
} from "@/lib/db.types";
import type { BrandLite, UserCapabilities } from "@/lib/types/brand-lite";

type BrandViewRow = Pick<LoyaltyMembershipViewRow, "brand_id" | "brand_slug" | "brand_name">;

function mapBrandRows<T extends BrandViewRow>(rows: readonly T[] | null | undefined): BrandLite[] {
  if (!rows) return [];

  return rows.map((row) => ({
    id: row.brand_id,
    slug: row.brand_slug,
    name: row.brand_name,
  }));
}

function resolveGMEmailList(): string[] {
  const raw =
    process.env.NEXT_PUBLIC_GM_EMAILS ??
    process.env.AGUI_GM_EMAILS ??
    "";

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isEmailGM(email: string | null): boolean {
  if (!email) return false;
  const list = resolveGMEmailList();
  return list.includes(email.toLowerCase());
}

export async function getCapabilitiesForUser(userId: string): Promise<UserCapabilities> {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const email = userRes?.user?.email ?? null;

  const [loyalty, employee, owner, profile] = await Promise.all([
    supabase
      .from("v_loyalty_memberships")
      .select("user_id, brand_id, brand_slug, brand_name")
      .eq("user_id", userId),
    supabase
      .from("v_employee_roster")
      .select("user_id, brand_id, brand_slug, brand_name, role")
      .eq("user_id", userId),
    supabase
      .from("v_brand_owners")
      .select("user_id, brand_id, brand_slug, brand_name")
      .eq("user_id", userId),
    supabase.from("profiles").select("is_gm").eq("id", userId).maybeSingle(),
  ]);

  const labelledResponses = [
    [loyalty, "loyalty memberships"],
    [employee, "employee roster"],
    [owner, "brand ownership"],
  ] as const;

  for (const [response, label] of labelledResponses) {
    if (response.error) {
      throw new Error(`Failed to load ${label}: ${response.error.message}`);
    }
  }

  const loyaltyRows = (loyalty.data ?? []) as LoyaltyMembershipViewRow[];
  const employeeRows = (employee.data ?? []) as EmployeeRosterViewRow[];
  const ownerRows = (owner.data ?? []) as BrandOwnerViewRow[];

  const loyaltyBrands = mapBrandRows<LoyaltyMembershipViewRow>(loyaltyRows);
  const employeeBrands = mapBrandRows<EmployeeRosterViewRow>(employeeRows);
  const ownerBrands = mapBrandRows<BrandOwnerViewRow>(ownerRows);

  const isGMFromProfile = profile.data?.is_gm ?? false;
  const profileMissing = profile.error?.code === "42P01";
  const profileErrored = profile.error && !profileMissing;

  const isGM = profileMissing || profileErrored
    ? isEmailGM(email)
    : Boolean(isGMFromProfile) || isEmailGM(email);

  return { loyaltyBrands, employeeBrands, ownerBrands, isGM };
}
