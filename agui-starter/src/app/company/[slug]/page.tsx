import { notFound, redirect } from "next/navigation";

import { loadWorkspaceSectionsForSlug } from "@/lib/tiles/server";

export const dynamic = "force-dynamic";

export default async function CompanyLanding({ params }: { params: { slug: string } }) {
  const sections = await loadWorkspaceSectionsForSlug(params.slug);

  if (!sections) {
    notFound();
  }

  const target = sections.sections.find((section) => section.key === "overview") ?? sections.sections[0];

  if (!target) {
    notFound();
  }

  redirect(target.defaultRoute);
}
