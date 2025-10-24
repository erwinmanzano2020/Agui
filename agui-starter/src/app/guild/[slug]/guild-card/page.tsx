import { ensureScheme } from "@/lib/loyalty/rules";
import IssueForm from "./issue-form";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function GuildCardIssue({ params }: { params: { slug: string } }) {
  const l = await labels();
  await ensureScheme("GUILD", "Guild Card", 2);
  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold">{l.guild} Card — Issue</div>
      <IssueForm scope="GUILD" />
    </div>
  );
}
