"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { ensureEntityForUser } from "@/lib/identity/entity-server";
import { evaluatePolicy } from "@/lib/policy/server";

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

  const { data: gmRole, error: gmRoleError } = await supabase
    .from("roles")
    .select("id")
    .in("key", ["gm", "owner"])
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (gmRoleError) {
    console.warn("Failed to resolve GM role for onboarding via key", gmRoleError);
  }

  let gmRoleId = gmRole?.id ?? null;
  if (!gmRoleId) {
    const { data: gmBySlug, error: gmSlugError } = await supabase
      .from("roles")
      .select("id")
      .in("slug", ["gm", "owner", "house_manager", "house_owner"])
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (gmSlugError) {
      console.warn("Failed to resolve GM role for onboarding via slug", gmSlugError);
    } else {
      gmRoleId = gmBySlug?.id ?? null;
    }
  }

  const { error: rpcError } = await supabase.rpc("onboard_employee", {
    p_house_id: inserted.id,
    p_entity_id: entityId,
    p_role_id: gmRoleId,
  });

  if (rpcError) {
    console.error("onboard_employee failed while creating business", rpcError);
    throw new Error(rpcError.message);
  }

  revalidateTag(`tiles:user:${user.id}`);
  redirect(`/company/${inserted.slug ?? slugCandidate}`);
}
