import type { ReactNode } from "react";
import { notFound } from "next/navigation";

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

  const sectionList = sections.sections;

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      {sectionList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          You don’t have access to any apps for this workspace yet.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
