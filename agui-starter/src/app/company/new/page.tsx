import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentEntityIsGM } from "@/lib/authz/server";
import { evaluatePolicyFromSet, getCurrentEntityAndPolicies } from "@/lib/policy/server";
import { emitEvent } from "@/lib/events/server";

import BusinessCreationWizard from "./wizard-client";

async function WizardLoader() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect(`/welcome?next=${encodeURIComponent("/company/new")}`);
  }

  const [{ entityId, policies }, isGM] = await Promise.all([
    getCurrentEntityAndPolicies(supabase, { context: "company/new" }),
    currentEntityIsGM(supabase),
  ]);

  const allowed = evaluatePolicyFromSet(policies, { action: "houses:create" });

  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">You can’t start a business yet</h1>
          <p className="text-sm text-muted-foreground">
            This action requires the houses:create policy. Ask your administrator to grant access.
          </p>
        </div>
      </main>
    );
  }

  const { data: roleRows, error: roleError } = entityId
    ? await supabase.from("house_roles").select("house_id").eq("entity_id", entityId)
    : { data: null, error: null };

  if (roleError) {
    console.warn("Failed to resolve existing workspaces for wizard", roleError);
  }

  const hadWorkspacesBefore = Boolean(roleRows && roleRows.length > 0);

  if (entityId) {
    await emitEvent("business_creation_wizard_started", "info", {
      actorEntityId: entityId,
      isGM,
      hadWorkspacesBefore,
    });
  }

  if (!entityId) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Almost there</h1>
          <p className="text-sm text-muted-foreground">
            We couldn’t resolve your entity record. Please sign out and sign back in to retry business creation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Create a business</h1>
        <p className="text-sm text-muted-foreground">
          Launch a new workspace for your team. You’ll become the first administrator automatically.
        </p>
      </header>
      <BusinessCreationWizard hadWorkspacesBefore={hadWorkspacesBefore} />
    </main>
  );
}

export default function NewCompanyPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">Loading…</main>}>
      <WizardLoader />
    </Suspense>
  );
}
