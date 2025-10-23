import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { loadUiTerms } from "@/lib/ui-terms";

import { TermsForm } from "./terms-form";

export default async function TermsSettingsPage() {
  const terms = await loadUiTerms();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Terminology</h1>
          <p className="text-sm text-muted-foreground">
            Update the language your town uses for alliances, guilds, companies, teams, and loyalty passes.
          </p>
        </CardHeader>
        <CardContent>
          <TermsForm initialTerms={terms} />
        </CardContent>
      </Card>
    </div>
  );
}
