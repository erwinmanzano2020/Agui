import Link from "next/link";
import { notFound } from "next/navigation";

import AppTile from "@/components/me/AppTile";
import { CashIcon, FinanceIcon, GearIcon, HrIcon, OverviewIcon, OpsIcon } from "@/components/workspace/icons";
import TileGrid from "@/components/me/TileGrid";
import { loadUiConfig } from "@/lib/ui-config";
import { loadWorkspaceSectionsForSlug } from "@/lib/tiles/server";

const APP_ORDER = ["overview", "operations", "cashiering", "people", "finance", "settings"] as const;

type SectionKey = (typeof APP_ORDER)[number];

type TileDefinition = {
  key: SectionKey;
  label: string;
  desc: string;
  icon: JSX.Element;
};

const TILE_DEFINITIONS: Record<SectionKey, TileDefinition> = {
  overview: {
    key: "overview",
    label: "Overview",
    desc: "Workspace overview",
    icon: <OverviewIcon />,
  },
  operations: {
    key: "operations",
    label: "Operations",
    desc: "Store operations & POS",
    icon: <OpsIcon />,
  },
  cashiering: {
    key: "cashiering",
    label: "Cashiering",
    desc: "Shift close & drop verification",
    icon: <CashIcon />,
  },
  people: {
    key: "people",
    label: "HR",
    desc: "People, time & payroll",
    icon: <HrIcon />,
  },
  finance: {
    key: "finance",
    label: "Finance",
    desc: "Ledger & payroll finance",
    icon: <FinanceIcon />,
  },
  settings: {
    key: "settings",
    label: "Settings",
    desc: "Workspace settings",
    icon: <GearIcon />,
  },
};

export const dynamic = "force-dynamic";

export default async function CompanyLauncher({ params }: { params: { slug: string } }) {
  const [sections, uiConfig] = await Promise.all([
    loadWorkspaceSectionsForSlug(params.slug),
    loadUiConfig(),
  ]);

  if (!sections) {
    notFound();
  }

  const hrEnabled = uiConfig.flags?.hr_enabled ?? true;
  const sectionMap = new Map(sections.sections.map((section) => [section.key, section]));
  const workspaceLabel = sections.meta?.label ?? params.slug;

  const tiles = APP_ORDER.flatMap((key) => {
    const section = sectionMap.get(key);
    if (!section) {
      return [];
    }
    if (key === "people" && !hrEnabled) {
      return [
        <div
          key={`${key}-coming-soon`}
          className="rounded-2xl border border-dashed border-border bg-white/70 p-5 text-sm text-muted-foreground shadow-sm"
        >
          HR is coming soon for this workspace.
        </div>,
      ];
    }

    const definition = TILE_DEFINITIONS[key];
    return [
      <AppTile
        key={key}
        href={section.defaultRoute}
        title={definition.label}
        desc={definition.desc}
        icon={definition.icon}
      />,
    ];
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <Link href="/me" className="underline">
            Me
          </Link>{" "}
          → {workspaceLabel}
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">{workspaceLabel}</h1>
          <p className="text-sm text-muted-foreground">Open an app to manage this workspace.</p>
        </div>
      </header>

      {tiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          You don’t have access to any apps for this workspace yet.
        </div>
      ) : (
        <TileGrid className="md:!grid-cols-2 lg:!grid-cols-3">{tiles}</TileGrid>
      )}
    </main>
  );
}
