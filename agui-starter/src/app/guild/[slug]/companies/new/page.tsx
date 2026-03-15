import { notFound } from "next/navigation";
import { loadGuild } from "./actions";
import NewCompanyForm from "./new-company-form";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage({ params }: { params: { slug: string } }) {
  const guild = await loadGuild(params.slug);
  if (!guild) return notFound();
  const l = await labels();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold">{guild.name}</div>
        <div className="text-xs text-muted-foreground">/{guild.slug}</div>
      </div>

      <NewCompanyForm slug={guild.slug} />

      <p className="text-xs text-muted-foreground">
        Only {l.guild} members can create a {l.company}. The creator becomes <code>house_owner</code>.
      </p>
    </div>
  );
}
