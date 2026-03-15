import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ForbiddenStateProps = {
  title?: string;
  description?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
};

export function ForbiddenState({
  title = "You don’t have access to this page.",
  description = "Ask your administrator to grant the required role, or head back to the launcher.",
  actionHref = "/",
  actionLabel = "Go home",
}: ForbiddenStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <Card className="w-full max-w-lg border border-border/70 bg-card/90">
        <CardHeader className="border-none px-6 pt-6 pb-3">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 text-sm text-muted-foreground">
          <p>{description}</p>
          <Button asChild size="sm">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
