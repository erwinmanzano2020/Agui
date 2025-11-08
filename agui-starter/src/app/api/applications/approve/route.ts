import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getMyRoles } from "@/lib/authz/server";
import { ensureEntityByEmail } from "@/lib/identity/entity";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  listAccountUserIds,
  parseOnboardEmployeeResult,
  type OnboardEmployeeResult,
} from "@/lib/employments";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

async function ensureEntityByPhone(
  svc: SupabaseClient,
  phone: string,
  displayName: string | null,
): Promise<string> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error("Invalid phone number");
  }

  const { data: existing, error: lookupError } = await svc
    .from("entity_identifiers")
    .select("entity_id")
    .eq("kind", "phone")
    .eq("value_norm", normalized)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up phone identifier: ${lookupError.message}`);
  }

  if (existing?.entity_id) {
    return existing.entity_id as string;
  }

  const label = displayName && displayName.length > 0 ? displayName : `Applicant ${normalized}`;
  const { data: entity, error: entityError } = await svc
    .from("entities")
    .insert({ display_name: label })
    .select("id")
    .single();

  if (entityError || !entity) {
    throw new Error(entityError?.message ?? "Failed to create entity");
  }

  const { error: linkError } = await svc.from("entity_identifiers").insert({
    entity_id: entity.id,
    kind: "phone",
    value_norm: normalized,
  } as never);

  if (linkError) {
    throw new Error(linkError.message);
  }

  return entity.id as string;
}

async function ensureApplicantEntity(
  svc: SupabaseClient,
  application: { name: string | null; email: string | null; phone: string | null },
): Promise<string> {
  const preferredName = application.name && application.name.trim().length > 0 ? application.name.trim() : null;

  if (application.email) {
    const email = normalizeEmail(application.email);
    if (!email) {
      throw new Error("Invalid email address");
    }
    const entity = await ensureEntityByEmail(email, { displayName: preferredName ?? email }, svc);
    return entity.id;
  }

  if (application.phone) {
    return ensureEntityByPhone(svc, application.phone, preferredName);
  }

  throw new Error("Application missing contact details");
}

type ValidatedRole = {
  id: string;
  slug: string | null;
};

async function validateRole(
  svc: SupabaseClient,
  businessId: string,
  roleId: string | null,
): Promise<ValidatedRole | null> {
  if (!roleId) {
    return null;
  }

  const trimmed = roleId.trim();
  if (!trimmed) {
    return null;
  }

  const { data, error } = await svc
    .from("roles")
    .select("id, slug, scope, scope_ref")
    .eq("id", trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify role: ${error.message}`);
  }

  if (!data) {
    throw new Error("Role not found");
  }

  const scope = (data as { scope?: string | null }).scope ?? null;
  const scopeRef = (data as { scope_ref?: string | null }).scope_ref ?? null;
  if (scope !== "HOUSE" || (scopeRef && scopeRef !== businessId)) {
    throw new Error("Role not assignable to this business");
  }

  return {
    id: (data as { id: string }).id,
    slug: ((data as { slug?: string | null }).slug ?? null) as string | null,
  } satisfies ValidatedRole;
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const applicationId = normalizeString((body as { applicationId?: unknown }).applicationId);
  const roleIdRaw = normalizeString((body as { roleId?: unknown }).roleId);

  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = getServiceSupabase();

  let actorEntityId: string;
  try {
    const resolved = await resolveEntityIdForUser(user, service);
    if (!resolved) {
      return NextResponse.json({ error: "Account not linked to entity" }, { status: 400 });
    }
    actorEntityId = resolved;
  } catch (error) {
    console.error("Failed to resolve actor entity", error);
    return NextResponse.json({ error: "Failed to resolve entity" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");

  const { data: application, error: applicationError } = await service
    .from("applications")
    .select("id, business_id, name, email, phone, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error("Failed to load application", applicationError);
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
  }

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "pending") {
    return NextResponse.json({ error: "Application already processed" }, { status: 400 });
  }

  let authorized = isGM;
  if (!authorized) {
    const { data, error } = await service
      .from("house_roles")
      .select("role")
      .eq("entity_id", actorEntityId)
      .eq("house_id", application.business_id);

    if (error) {
      console.error("Failed to verify actor permissions", error);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    authorized = (data ?? []).some((entry) =>
      entry && typeof entry.role === "string" && ["house_owner", "house_manager"].includes(entry.role),
    );
  }

  if (!authorized) {
    return forbidden("Insufficient permissions to approve applications");
  }

  let resolvedRole: ValidatedRole | null = null;
  try {
    resolvedRole = await validateRole(service, application.business_id, roleIdRaw || null);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  let applicantEntityId: string;
  try {
    applicantEntityId = await ensureApplicantEntity(service, {
      name: (application as { name?: string | null }).name ?? null,
      email: (application as { email?: string | null }).email ?? null,
      phone: (application as { phone?: string | null }).phone ?? null,
    });
  } catch (error) {
    console.error("Failed to prepare applicant entity", error);
    return NextResponse.json({ error: "Failed to prepare applicant" }, { status: 500 });
  }

  let onboarded: OnboardEmployeeResult = { employment: null, houseRole: null };
  try {
    const { data: onboardData, error: onboardError } = await service.rpc("onboard_employee", {
      p_house_id: application.business_id,
      p_entity_id: applicantEntityId,
      p_role_id: resolvedRole?.id ?? null,
      p_role_slug: resolvedRole?.slug ?? "house_staff",
    });

    if (onboardError) {
      throw onboardError;
    }

    onboarded = parseOnboardEmployeeResult(onboardData);

    if (!onboarded.employment) {
      throw new Error("onboard_employee did not return employment");
    }
  } catch (error) {
    console.error("Failed to create employment", error);
    return NextResponse.json({ error: "Failed to create employment" }, { status: 500 });
  }

  const { error: updateError } = await service
    .from("applications")
    .update({
      status: "approved",
      decided_by: actorEntityId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "pending");

  if (updateError) {
    console.error("Failed to update application status", updateError);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }

  try {
    const userIds = await listAccountUserIds(applicantEntityId).catch((error) => {
      console.error("Failed to load applicant accounts for revalidation", error);
      return [] as string[];
    });
    const targets = new Set<string>(userIds);
    for (const id of targets) {
      revalidateTag(`tiles:user:${id}`);
    }
  } catch (error) {
    console.error("Failed to revalidate tiles after approval", error);
  }

  return NextResponse.json({
    ok: true,
    employmentId: onboarded.employment?.id ?? null,
    houseRole: onboarded.houseRole?.role ?? null,
  });
}
