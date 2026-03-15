import { notFound } from "next/navigation";

export default function MarketplaceRequestPage({ searchParams }: { searchParams?: { app?: string } }) {
  const appKey = searchParams?.app;

  if (!appKey) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Request {appKey}</h1>
        <p className="text-sm text-muted-foreground">
          This flow is coming soon. Contact support to enable the app in the meantime.
        </p>
      </header>
    </main>
  );
}
