import { notFound } from "next/navigation";
import { loadGuild } from "./actions";
import JoinForm from "./join-form";
import { labels } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function JoinGuildPage({ params }: { params: { slug: string } }) {
  const guild = await loadGuild(params.slug);
  if (!guild) return notFound();
  const l = await labels();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold">{guild.name}</div>
        <div className="text-xs text-muted-foreground">/{guild.slug}</div>
      </div>
      <JoinForm slug={guild.slug} />
      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground">
          Joining makes you a {l.guild} member (role: <code>guild_member</code>). You can leave or upgrade later.
        </CardContent>
      </Card>
    </div>
  );
}
