import { notFound } from "next/navigation";

import { CustomRoleForm } from "./CustomRoleForm";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { evaluatePolicyForCurrentUser, getMyEntityId } from "@/lib/authz/server";

type AssignablePolicy = {
  id: string;
  key: string;
  action: string;
  resource: string;
  description: string | null;
};

type RolePolicyRow = {
  role_id: string;
  policy_key: string;
  action: string;
  resource: string;
  description: string | null;
};

type RoleSummary = {
  id: string;
  label: string;
  slug: string;
  policies: RolePolicyRow[];
};

type PageParams = {
  params: {
    slug: string;
  };
};

export const dynamic = "force-dynamic";

export default async function CustomRolesPage({ params }: PageParams) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    notFound();
  }

  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, name, slug")
    .eq("slug", params.slug)
    .maybeSingle();

  if (houseError || !house) {
    notFound();
  }

  const entityId = await getMyEntityId(supabase);
  if (!entityId) {
    notFound();
  }

  const { data: membership, error: membershipError } = await supabase
    .from("house_roles")
    .select("role")
    .eq("house_id", house.id)
    .eq("entity_id", entityId)
    .eq("role", "house_owner")
    .maybeSingle();

  if (membershipError || !membership) {
    notFound();
  }

  const allowed = await evaluatePolicyForCurrentUser(
    { action: "roles:manage", resource: "house" },
    supabase,
  );

  if (!allowed) {
    notFound();
  }

  const { data: policiesData, error: policiesError } = await supabase
    .from("policies")
    .select("id, key, action, resource, description, is_assignable")
    .eq("is_assignable", true)
    .order("key", { ascending: true });

  if (policiesError) {
    throw policiesError;
  }

  const policies: AssignablePolicy[] = (policiesData ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    action: row.action,
    resource: row.resource,
    description: row.description,
  }));

  const { data: roleRows, error: roleError } = await supabase
    .from("roles")
    .select("id, label, slug")
    .eq("scope", "HOUSE")
    .eq("scope_ref", house.id)
    .eq("is_system", false)
    .order("label", { ascending: true });

  if (roleError) {
    throw roleError;
  }

  let rolePolicies: RolePolicyRow[] = [];
  if (roleRows && roleRows.length > 0) {
    const identifiers = roleRows.map((role) => role.id);
    const { data: policyLinks, error: policyLinkError } = await supabase
      .from("role_policy_catalog")
      .select("role_id, policy_key, action, resource, description")
      .in("role_id", identifiers);

    if (policyLinkError) {
      throw policyLinkError;
    }

    rolePolicies = policyLinks ?? [];
  }

  const summaries: RoleSummary[] = (roleRows ?? []).map((role) => ({
    id: role.id,
    label: role.label,
    slug: role.slug,
    policies: rolePolicies.filter((entry) => entry.role_id === role.id),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Custom roles</p>
        <h1 className="text-2xl font-semibold text-foreground">{house.name}</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage custom roles for this house. Changes take effect immediately.
        </p>
      </header>

      <CustomRoleForm houseId={house.id} houseSlug={house.slug} policies={policies} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Existing custom roles</h2>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom roles yet. Create one above to get started.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {summaries.map((role) => (
              <li
                key={role.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-base font-medium text-foreground">{role.label}</span>
                  <span className="text-xs text-muted-foreground">{role.slug}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {role.policies.length === 0 ? (
                    <span>No policies assigned yet.</span>
                  ) : (
                    role.policies.map((policy) => (
                      <span key={`${role.id}-${policy.policy_key}`} className="block">
                        {policy.policy_key}
                        <span className="text-[10px] text-muted-foreground/80">
                          {` · ${policy.action} → ${policy.resource}`}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
