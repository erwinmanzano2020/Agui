import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { loadWorkspaceSectionsForSlug } from "@/lib/tiles/server";

export default async function CompanyLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const { slug } = await params;
  const sections = await loadWorkspaceSectionsForSlug(slug);

  if (!sections) {
    notFound();
  }

  const companyLabel = sections.meta?.label ?? slug;

  const sectionList = sections.sections;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 lg:flex-row">
      <WorkspaceNav companyLabel={companyLabel} sections={sectionList} />
      <div className="flex-1 lg:min-w-0">
        {sectionList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            You don’t have access to any sections for this workspace yet.
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
