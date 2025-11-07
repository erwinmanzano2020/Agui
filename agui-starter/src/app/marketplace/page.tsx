import Link from "next/link";
import { redirect } from "next/navigation";

import { loadTilesForCurrentUser } from "@/lib/tiles/server";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const tiles = await loadTilesForCurrentUser();

  if (!tiles.marketplace) {
    redirect("/me");
  }

  const { categories } = tiles.marketplace;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Request new apps to unlock features for your workspaces. Enabled apps are hidden automatically.
        </p>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nothing to request right now. Check back after expanding your permissions.
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <section key={category.key} className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{category.key}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {category.items.map((item) => (
                  <div
                    key={item.appKey}
                    className="rounded-2xl border border-border bg-white p-4 shadow-sm"
                  >
                    <div className="text-base font-medium text-foreground">{item.name}</div>
                    {item.reason ? (
                      <div className="mt-1 text-xs text-muted-foreground">{item.reason}</div>
                    ) : (
                      <Link
                        href={`/marketplace/request?app=${encodeURIComponent(item.appKey)}`}
                        className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                      >
                        Request access →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
