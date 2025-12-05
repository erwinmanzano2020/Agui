import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadTilesForCurrentUser } from "@/lib/tiles/server";
import type { HomeTile, WorkspaceSections } from "@/lib/tiles/types";
import AppTile from "@/components/me/AppTile";
import TileGrid from "@/components/me/TileGrid";
import { loadUiConfig } from "@/lib/ui-config";

function workspaceRouteFromSections(workspaces: WorkspaceSections[], businessId: string): string | null {
  const workspace = workspaces.find((entry) => entry.businessId === businessId);
  if (!workspace) {
    return null;
  }
  const overview = workspace.sections.find((section) => section.key === "overview");
  const fallback = workspace.sections[0];
  return overview?.defaultRoute ?? fallback?.defaultRoute ?? null;
}

function routeForTile(tile: HomeTile, workspaces: WorkspaceSections[]): string {
  switch (tile.kind) {
    case "workspace": {
      const route = workspaceRouteFromSections(workspaces, tile.businessId);
      if (route) {
        return route;
      }
      return `/company/${tile.businessId}`;
    }
    case "loyalty-pass":
      return `/passes/member?businessId=${encodeURIComponent(tile.businessId)}`;
    case "marketplace":
      return "/marketplace";
    case "inbox":
      return "/inbox";
    case "gm-console":
      return "/admin";
    case "start-business":
      return "/company/new";
    default:
      return "/";
  }
}

function TileCard({ tile, href }: { tile: HomeTile; href: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-white p-4 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="text-base font-medium text-foreground">
        {tile.label}
      </div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {tile.kind === "workspace" && "Workspace"}
        {tile.kind === "loyalty-pass" && "Loyalty"}
        {tile.kind === "marketplace" && "Marketplace"}
        {tile.kind === "inbox" && "Inbox"}
        {tile.kind === "gm-console" && "Console"}
        {tile.kind === "start-business" && "Action"}
      </div>
    </Link>
  );
}

export default async function MePage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect(`/welcome?next=${encodeURIComponent("/me")}`);
  }

  const [tiles, uiConfig] = await Promise.all([loadTilesForCurrentUser(), loadUiConfig()]);
  const user = data.user;
  const hrEnabled = uiConfig.flags?.hr_enabled ?? true;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
      </header>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Home</h2>
          <p className="text-sm text-muted-foreground">Quick entry points across your memberships and workspaces.</p>
        </div>
        {tiles.home.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No tiles available yet. Check back after joining a business or loyalty program.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.home.map((tile) => (
              <TileCard key={`${tile.kind}-${"businessId" in tile ? tile.businessId : tile.label}`} tile={tile} href={routeForTile(tile, tiles.workspaces)} />
            ))}
          </div>
        )}
      </section>

      {tiles.marketplace ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Marketplace</h2>
              <p className="text-sm text-muted-foreground">Discover apps you can request for your stores.</p>
            </div>
            <Link href="/marketplace" className="text-sm font-medium text-primary hover:underline">
              Open Marketplace →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Employment / Business</h2>
          <p className="text-sm text-muted-foreground">Open the apps linked to your workspaces.</p>
        </div>

        {tiles.workspaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No workspaces linked yet.
          </div>
        ) : (
          <div className="space-y-4">
            {tiles.workspaces.map((workspace) => {
              const workspaceLabel = workspace.meta?.label ?? workspace.businessId;
              const workspaceSlug = workspace.meta?.slug ?? workspace.businessId;
              const hasHrApp = workspace.sections.some((section) => (section.apps ?? []).includes("hr"));
              const hrHref = `/company/${workspaceSlug}/hr/employees`;

              return (
                <div
                  key={workspace.businessId}
                  className="space-y-3 rounded-2xl border border-border bg-white/70 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
                      <div className="text-base font-semibold text-foreground">{workspaceLabel}</div>
                    </div>
                    <Link href={workspace.sections[0]?.defaultRoute ?? `/company/${workspaceSlug}`}>View workspace →</Link>
                  </div>

                  {!hrEnabled ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      HR is coming soon for this workspace.
                    </div>
                  ) : hasHrApp ? (
                    <TileGrid className="md:!grid-cols-2 lg:!grid-cols-3">
                      <AppTile href={hrHref} title="HR" desc="Employees, time & payroll" />
                    </TileGrid>
                  ) : (
                    <div className="rounded-xl border border-border bg-white/60 p-4 text-sm text-muted-foreground shadow-sm">
                      HR is not available for your role in this workspace.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
