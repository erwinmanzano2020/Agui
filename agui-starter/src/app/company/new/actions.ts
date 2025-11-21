"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { slugify } from "@/lib/slug";
import { ensureEntityForUser } from "@/lib/identity/entity-server";
import { evaluatePolicy } from "@/lib/policy/server";
import { emitEvent } from "@/lib/events/server";
import { currentEntityIsGM } from "@/lib/authz/server";
import { getOrCreateGuildForWorkspace } from "@/lib/guilds/server";

import { ensureCreatorEmployment, type CreatorEmploymentResult } from "./employment";

const BUSINESS_KIND_TO_HOUSE_TYPE: Record<string, string> = {
  grocery: "RETAIL",
  cafe: "RETAIL",
  cafe_bar: "RETAIL",
  laundry: "SERVICE",
  pharmacy: "RETAIL",
  restaurant: "RETAIL",
  services: "SERVICE",
  retail: "RETAIL",
};

const FALLBACK_HOUSE_TYPE = "RETAIL";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coerceBusinessKind(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized in BUSINESS_KIND_TO_HOUSE_TYPE) {
    return normalized;
  }
  return "retail";
}

function formatGuildError(error: unknown): string {
  if (error instanceof Error) {
    const supabaseLike = error as any;
    const parts = [error.message];
    if (supabaseLike?.details) parts.push(`details: ${supabaseLike.details}`);
    if (supabaseLike?.hint) parts.push(`hint: ${supabaseLike.hint}`);
    if (supabaseLike?.code) parts.push(`code: ${supabaseLike.code}`);

    const cause = (supabaseLike?.cause ?? null) as null | Record<string, unknown>;
    if (cause && typeof cause === "object") {
      const causeDetails = [cause.message, cause.details, cause.hint, cause.code].filter(Boolean).join(" | ");
      if (causeDetails) {
        parts.push(`cause: ${causeDetails}`);
      }
    }

    return parts.filter(Boolean).join(" | ");
  }

  if (typeof error === "object" && error) {
    try {
      return JSON.stringify(error);
    } catch (stringifyError) {
      return `Non-Error object thrown (stringify failed: ${String(stringifyError)})`;
    }
  }

  return typeof error === "string" ? error : "Unknown error";
}

type MaybeBusinessRow = { id: string; slug: string | null; name?: string | null };

type MaybeBranchRow = { id: string; name: string | null; slug: string | null };

type BusinessSummary = {
  id: string;
  name: string;
  slug: string | null;
};

type BranchSummary = {
  id: string;
  name: string;
  slug: string | null;
};

export type BusinessCreationWizardInput = {
  name: string;
  slug?: string | null;
  businessType: string;
  logoUrl?: string | null;
  slogan?: string | null;
};

export type BusinessCreationWizardResult =
  | {
      status: "error";
      formError: string;
      code?: number;
      fieldErrors?: Record<string, string | null>;
    }
  | {
      status: "success";
      business: BusinessSummary;
      branch: BranchSummary | null;
    };

function isRelationMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return message.includes("relation") && message.includes("does not exist");
}

async function slugInUse(supabase: unknown, table: "houses", slug: string): Promise<boolean> {
  const client: any = supabase;
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isRelationMissing(error)) {
      return false;
    }
    throw new Error(error.message);
  }

  const row = data as MaybeBusinessRow | null;
  return Boolean(row?.id);
}

async function assertUniqueSlug(supabase: unknown, slug: string): Promise<void> {
  const fromHouses = await slugInUse(supabase, "houses", slug);
  if (fromHouses) {
    throw new Error("Slug is already taken");
  }
}

async function assignBusinessRole(supabase: unknown, businessId: string, entityId: string, role: string): Promise<boolean> {
  const client: any = supabase;
  const { error } = await client.from("house_roles").upsert(
    { house_id: businessId, entity_id: entityId, role },
    { onConflict: "house_id,entity_id,role" },
  );
  if (error) {
    console.warn("Failed to assign role", { role, error });
    return false;
  }
  return true;
}

async function assignBusinessRoles(supabase: unknown, businessId: string, entityId: string): Promise<void> {
  const attempted = await Promise.all([
    assignBusinessRole(supabase, businessId, entityId, "BUSINESS_OWNER"),
    assignBusinessRole(supabase, businessId, entityId, "BUSINESS_ADMIN"),
  ]);

  if (!attempted.every(Boolean)) {
    // Fallback to legacy role names when the new constants are unavailable.
    await Promise.all([
      assignBusinessRole(supabase, businessId, entityId, "house_owner"),
      assignBusinessRole(supabase, businessId, entityId, "house_manager"),
    ]);
  }
}

async function createDefaultBranch(supabase: unknown, businessId: string, businessSlug: string): Promise<BranchSummary | null> {
  try {
    const client: any = supabase;
    const { data, error } = await client
      .from("branches")
      .insert({ house_id: businessId, name: "Main Branch" })
      .select("id, name, slug")
      .maybeSingle();

    if (error) {
      if (!isRelationMissing(error)) {
        console.warn("Failed to create default branch", error);
      }
      return null;
    }

    const branch = data as MaybeBranchRow | null;
    if (!branch?.id) {
      return null;
    }

    return {
      id: branch.id,
      name: branch.name ?? "Main Branch",
      slug: branch.slug ?? `${businessSlug}-main`,
    } satisfies BranchSummary;
  } catch (branchError) {
    console.warn("Unexpected error creating branch", branchError);
    return null;
  }
}

export async function createBusinessWizard(
  input: BusinessCreationWizardInput,
): Promise<BusinessCreationWizardResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.warn("Failed to resolve current user for business wizard", error);
  }

  const user = data?.user ?? null;
  if (!user) {
    return { status: "error", formError: "Unauthorized", code: 401 };
  }

  const allowed = await evaluatePolicy({ action: "houses:create" }, supabase);
  if (!allowed) {
    return { status: "error", formError: "Forbidden", code: 403 };
  }

  const name = normalizeString(input.name);
  const providedSlug = normalizeString(input.slug ?? null);
  const slugCandidate = providedSlug ? slugify(providedSlug) : slugify(name);
  const businessType = coerceBusinessKind(normalizeString(input.businessType || ""));
  const houseType = BUSINESS_KIND_TO_HOUSE_TYPE[businessType] ?? FALLBACK_HOUSE_TYPE;
  const logoUrl = normalizeString(input.logoUrl ?? null);
  const slogan = normalizeString(input.slogan ?? null);
  const writeClient: any = getServiceSupabase();

  const fieldErrors: Record<string, string | null> = {};
  if (!name) {
    fieldErrors.name = "Business name is required";
  }
  if (!slugCandidate) {
    fieldErrors.slug = "Slug could not be generated";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", formError: "Validation failed", fieldErrors };
  }

  try {
    await assertUniqueSlug(writeClient, slugCandidate);
  } catch (slugError) {
    return {
      status: "error",
      formError: slugError instanceof Error ? slugError.message : "Slug validation failed",
      fieldErrors: { slug: "Slug is already taken" },
    };
  }

  const entityId = await ensureEntityForUser(user, writeClient).catch((entityError) => {
    console.error("Failed to resolve entity for wizard creator", entityError);
    throw entityError;
  });

  let guildId: string;
  try {
    console.info("wizard:guild:prepare", {
      entityId,
      slug: slugCandidate,
      businessName: name,
    });
    const guildResult = await getOrCreateGuildForWorkspace(
      {
        entityId,
        workspaceSlug: slugCandidate,
        businessName: name,
      },
      writeClient,
    );
    guildId = guildResult.guildId;
  } catch (guildError) {
    console.error("Failed to resolve or create guild for workspace", guildError);
    const formattedError = formatGuildError(guildError);
    return {
      status: "error",
      formError: `Failed to prepare workspace guild: ${formattedError}`,
      code: 500,
    };
  }

  let insertedBusiness: MaybeBusinessRow | null = null;
  let insertError: Error | null = null;

  const payload: Record<string, unknown> = {
    name,
    slug: slugCandidate,
    house_type: houseType,
    guild_id: guildId,
  };

  if (logoUrl) {
    payload.logo_url = logoUrl;
  }
  if (slogan) {
    payload.tagline = slogan;
  }

  const { data: primaryInsert, error: primaryError } = await writeClient
    .from("houses")
    .insert(payload)
    .select("id, slug, name")
    .maybeSingle();

  if (primaryError) {
    console.warn("Primary business insert failed, retrying with fallback payload", primaryError);
    const fallbackPayload = { name, slug: slugCandidate } satisfies Record<string, unknown>;
    const { data: fallbackInsert, error: fallbackError } = await writeClient
      .from("houses")
      .insert(fallbackPayload)
      .select("id, slug, name")
      .maybeSingle();
    insertedBusiness = fallbackInsert ?? null;
    insertError = fallbackError ? new Error(fallbackError.message) : null;
  } else {
    insertedBusiness = primaryInsert ?? null;
  }

  if (insertError) {
    return { status: "error", formError: insertError.message };
  }

  if (!insertedBusiness?.id) {
    return { status: "error", formError: "Failed to create business" };
  }

  if (primaryError && houseType) {
    // Attempt to patch in the desired house_type if the column exists but the first insert failed.
    try {
      await writeClient.from("houses").update({ house_type: houseType }).eq("id", insertedBusiness.id);
    } catch (patchError) {
      console.warn("Failed to backfill house_type", patchError);
    }
  }

  if (logoUrl || slogan) {
    try {
      const updates: Record<string, string> = {};
      if (logoUrl) updates.logo_url = logoUrl;
      if (slogan) updates.tagline = slogan;
      if (Object.keys(updates).length > 0) {
        await writeClient.from("houses").update(updates).eq("id", insertedBusiness.id);
      }
    } catch (metadataError) {
      console.warn("Failed to persist optional branding details", metadataError);
    }
  }

  await assignBusinessRoles(writeClient, insertedBusiness.id, entityId);

  const branch = await createDefaultBranch(writeClient, insertedBusiness.id, slugCandidate);

  let creatorEmploymentResult: CreatorEmploymentResult | null = null;
  try {
    creatorEmploymentResult = await ensureCreatorEmployment(writeClient, insertedBusiness.id, entityId);
    console.info("wizard: creator employment ensured", {
      businessId: insertedBusiness.id,
      branchId: branch?.id ?? null,
      entityId,
      roleId: creatorEmploymentResult.roleId,
      roleSlug: creatorEmploymentResult.roleSlug,
      employmentId: creatorEmploymentResult.employmentId,
    });
  } catch (employmentError) {
    console.error("Failed to ensure creator employment", employmentError);
    return { status: "error", formError: "Failed to finalize creator employment", code: 500 };
  }

  const isGM = await currentEntityIsGM(supabase);

  if (!isGM) {
    try {
      const { data: policyRow } = await writeClient
        .from("policies")
        .select("id")
        .eq("key", "houses:create")
        .maybeSingle();

      const policyId = policyRow && typeof policyRow === "object" ? (policyRow as { id?: unknown }).id : null;

      if (typeof policyId === "string" && policyId) {
        const { error: revokeError } = await writeClient
          .from("entity_policy_grants")
          .delete()
          .eq("entity_id", entityId)
          .eq("policy_id", policyId);

        if (revokeError) {
          console.warn("Failed to revoke houses:create policy", revokeError);
        } else {
          await emitEvent("policy_revoked_houses_create", "info", {
            actorEntityId: entityId,
            businessId: insertedBusiness.id,
          });
        }
      }
    } catch (policyError) {
      console.warn("Unexpected error revoking houses:create policy", policyError);
    }
  }

  const businessSummary: BusinessSummary = {
    id: insertedBusiness.id,
    name: insertedBusiness.name ?? name,
    slug: insertedBusiness.slug ?? slugCandidate,
  };

  await Promise.all([
    emitEvent("business:created", "info", {
      businessId: businessSummary.id,
      slug: businessSummary.slug,
      creatorEntityId: entityId,
      isGM,
    }),
    emitEvent("business_created", "info", {
      businessId: businessSummary.id,
      creatorEntityId: entityId,
      isGM,
    }),
    emitEvent("employment:created", "info", {
      businessId: businessSummary.id,
      branchId: branch?.id ?? null,
      entityId,
      roleId: creatorEmploymentResult?.roleId ?? null,
      employmentId: creatorEmploymentResult?.employmentId ?? null,
    }),
    emitEvent("tiles:invalidate", "info", { entityId }),
    emitEvent("settings:invalidate", "info", { scope: "BUSINESS", businessId: businessSummary.id }),
    emitEvent(`tiles:user:${user.id}`, "invalidate", {
      reason: "business created",
      businessId: businessSummary.id,
    }),
    emitEvent("audit", "info", {
      action: "business:create",
      businessId: businessSummary.id,
      actorEntityId: entityId,
    }),
    emitEvent("audit", "info", {
      action: "employment:create",
      businessId: businessSummary.id,
      branchId: branch?.id ?? null,
      actorEntityId: entityId,
      subject: {
        businessId: businessSummary.id,
        branchId: branch?.id ?? null,
        entityId,
        roleId: creatorEmploymentResult?.roleId ?? null,
        employmentId: creatorEmploymentResult?.employmentId ?? null,
      },
    }),
  ]).catch((eventError) => {
    console.warn("Failed to emit one or more business creation events", eventError);
  });

  console.info("business created", { businessId: businessSummary.id, slug: businessSummary.slug, userId: user.id });

  return {
    status: "success",
    business: businessSummary,
    branch,
  } satisfies BusinessCreationWizardResult;
}
