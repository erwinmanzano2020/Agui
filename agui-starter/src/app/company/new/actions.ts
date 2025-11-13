"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { ensureEntityForUser } from "@/lib/identity/entity-server";
import { evaluatePolicy } from "@/lib/policy/server";
import { emitEvent } from "@/lib/events/server";

type MaybeHouse = { id: string }; // minimal shape for slug check

type InsertedHouse = { id: string; slug: string | null };

function coerceString(input: FormDataEntryValue | null): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim();
}

export async function createHouse(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.warn("Failed to resolve current user for createHouse", error);
  }

  const user = data?.user;
  if (!user) {
    redirect(`/welcome?next=${encodeURIComponent("/company/new")}`);
  }

  const allowed = await evaluatePolicy({ action: "houses:create" }, supabase);
  if (!allowed) {
    redirect("/welcome?error=forbidden");
  }

  const name = coerceString(formData.get("name"));
  if (!name) {
    throw new Error("Name is required");
  }

  const rawSlug = coerceString(formData.get("slug"));
  const slugCandidate = slugify(rawSlug || name);
  if (!slugCandidate) {
    throw new Error("Slug could not be generated");
  }

  const { data: existing, error: slugError } = await supabase
    .from("houses")
    .select("id")
    .eq("slug", slugCandidate)
    .maybeSingle<MaybeHouse>();

  if (slugError) {
    throw new Error(slugError.message);
  }

  if (existing) {
    throw new Error("Slug is already taken");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("houses")
    .insert({ name, slug: slugCandidate })
    .select("id, slug")
    .single<InsertedHouse>();

  if (insertError) {
    throw new Error(insertError.message);
  }

  if (!inserted?.id) {
    throw new Error("Failed to create business");
  }

  const entityId = await ensureEntityForUser(user).catch((entityError) => {
    console.error("Failed to ensure entity for user", entityError);
    throw entityError;
  });

  const { data: ownerRole, error: ownerRoleError } = await supabase
    .from("roles")
    .select("id, slug")
    .eq("scope", "HOUSE")
    .eq("slug", "house_owner")
    .maybeSingle<{ id: string; slug: string }>();

  if (ownerRoleError) {
    console.warn("Failed to resolve house_owner role for onboarding", ownerRoleError);
  }

  let roleId = ownerRole?.id ?? null;
  let roleSlug = ownerRole?.slug ?? null;

  if (!roleId) {
    const { data: managerRole, error: managerRoleError } = await supabase
      .from("roles")
      .select("id, slug")
      .eq("scope", "HOUSE")
      .eq("slug", "house_manager")
      .maybeSingle<{ id: string; slug: string }>();

    if (managerRoleError) {
      console.warn("Failed to resolve house_manager role for onboarding", managerRoleError);
    } else {
      roleId = managerRole?.id ?? null;
      roleSlug = managerRole?.slug ?? null;
    }
  }

  const { error: rpcError } = await supabase.rpc("onboard_employee", {
    p_house_id: inserted.id,
    p_entity_id: entityId,
    p_role_id: roleId,
    p_role_slug: roleSlug ?? "house_owner",
  });

  if (rpcError) {
    console.error("onboard_employee failed while creating business", rpcError);
    throw new Error(rpcError.message);
  }

  await emitEvent(`tiles:user:${user.id}`, "invalidate", { reason: "business created", businessId: inserted.id });
  redirect(`/company/${inserted.slug ?? slugCandidate}`);
}
