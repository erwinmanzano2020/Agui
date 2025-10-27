import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ForbiddenPageProps = {
  searchParams?: { dest?: string };
};

function normalizeDest(raw?: string): string | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  if (!raw.startsWith("/")) {
    return null;
  }

  return raw;
}

export const metadata = {
  title: "Not Authorized",
};

export default function ForbiddenPage({ searchParams }: ForbiddenPageProps) {
  const dest = normalizeDest(searchParams?.dest);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <Card className="w-full max-w-lg border border-border/70 bg-card/95">
        <CardHeader className="border-none px-6 pt-6 pb-3">
          <h1 className="text-xl font-semibold text-foreground">You don’t have access to this page.</h1>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 text-sm text-muted-foreground">
          <p>
            Ask your administrator to grant the required role, or head back to the launcher.
            {dest ? ` Requested path: ${dest}` : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/">Go Home</Link>
            </Button>
            {dest ? (
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="pointer-events-none opacity-60"
                aria-disabled
              >
                <Link href="#">Request access</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
