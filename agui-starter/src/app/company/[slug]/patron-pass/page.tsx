import { ensureScheme } from "@/lib/loyalty/rules";
import IssueForm from "@/app/guild/[slug]/guild-card/issue-form";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PatronPassIssue() {
  const l = await labels();
  await ensureScheme("HOUSE", "Patron Pass", 3);
  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold">{l.house_pass} — Issue</div>
      <IssueForm scope="HOUSE" />
    </div>
  );
}
