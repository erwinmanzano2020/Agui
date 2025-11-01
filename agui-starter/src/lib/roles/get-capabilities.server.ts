import { createServerSupabase } from "@/lib/auth/server";
import type { BrandLite, UserCapabilities } from "@/lib/types/brand-lite";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

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

function isEmailGM(email: string | null | undefined): boolean {
  const csv = process.env.AGUI_GM_EMAILS || "";
  const list = csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return !!email && list.includes(email.toLowerCase());
}

async function readIsGM(
  supabase: SupabaseServerClient,
  userId: string,
  email: string | null
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_gm")
      .eq("id", userId)
      .maybeSingle();

    if (error?.code === "42P01") {
      return isEmailGM(email);
    }

    if (error) {
      return isEmailGM(email);
    }

    const row = data as { is_gm: boolean | null } | null | undefined;

    return Boolean(row?.is_gm) || isEmailGM(email);
  } catch {
    return isEmailGM(email);
  }
}

export async function getCapabilitiesForUser(userId: string): Promise<UserCapabilities> {
  const supabase = await createServerSupabase();

  const { data: userRes } = await supabase.auth.getUser();
  const email = userRes?.user?.email ?? null;

  const [loyalty, employee, owner] = await Promise.all([
    supabase.from("v_loyalty_memberships").select("*").eq("user_id", userId),
    supabase.from("v_employee_roster").select("*").eq("user_id", userId),
    supabase.from("v_brand_owners").select("*").eq("user_id", userId),
  ]);

  const responses = [
    { response: loyalty, context: "loyalty memberships" },
    { response: employee, context: "employee roster" },
    { response: owner, context: "brand ownership" },
  ];

  for (const { response, context } of responses) {
    if (response.error) {
      throw new Error(`Failed to load ${context}: ${response.error.message}`);
    }
  }

  const isGM = await readIsGM(supabase, userId, email);

  const loyaltyBrands = mapRows(loyalty.data);
  const employeeBrands = mapRows(employee.data);
  const ownerBrands = mapRows(owner.data);

  return { isGM, loyaltyBrands, employeeBrands, ownerBrands };
}
