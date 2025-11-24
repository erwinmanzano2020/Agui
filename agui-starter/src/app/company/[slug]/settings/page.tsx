import { notFound } from "next/navigation";

import WorkspaceSettingsForm from "./workspace-settings-form";
import { loadWorkspaceSettings } from "@/lib/settings/workspace";
import { canEditWorkspaceSettings } from "@/lib/settings/workspace-update";
import { loadBusinessBySlug } from "@/lib/workspaces/server";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage({ params }: { params: { slug: string } }) {
  const business = await loadBusinessBySlug(params.slug);
  if (!business) {
    notFound();
  }

  const [workspaceSettings, canEdit] = await Promise.all([
    loadWorkspaceSettings(business.id),
    canEditWorkspaceSettings(business.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Business</p>
        <h1 className="text-3xl font-semibold text-foreground">{business.name ?? business.slug ?? "Settings"}</h1>
        <p className="text-sm text-muted-foreground">Customize what your team sees across POS and cashiering.</p>
      </div>
      <WorkspaceSettingsForm
        businessSlug={business.slug ?? params.slug}
        canEdit={canEdit}
        initialValues={workspaceSettings}
      />
    </div>
  );
}
