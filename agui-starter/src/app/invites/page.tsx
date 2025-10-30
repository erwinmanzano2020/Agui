import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadUiTerms } from "@/lib/ui-terms";

export const dynamic = "force-dynamic";

export default async function InvitesIndexPage() {
  const terms = await loadUiTerms();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-muted-foreground">
          Manage pending invites for your {terms.team.toLowerCase()}.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">Invite management is coming soon.</p>
          <Button asChild>
            <Link href="/invites/new">Send a new invite</Link>
          </Button>
          <Button asChild variant="link">
            <Link href="/employees">Back to {terms.team}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
