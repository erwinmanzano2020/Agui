"use client";

import { useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { SplashScreen } from "@/app/(components)/SplashScreen";
import { Dock, type DockItem } from "@/app/(home)/Dock";
import { AppTile } from "@/app/(home)/AppTile";
import { StatusHud } from "@/components/ui/status-hud";

const TILE_DEFINITIONS = [
  { label: "Employees", href: "/employees", icon: "employees" as const },
  { label: "Shifts", href: "/shifts", icon: "shifts" as const },
  { label: "DTR Today", href: "/payroll/dtr-today", icon: "clock" as const },
  { label: "Payroll Settings", href: "/payroll/settings", icon: "settings" as const },
  { label: "Payroll Preview", href: "/payroll/preview", icon: "payroll" as const },
  { label: "Bulk DTR", href: "/payroll/dtr-bulk", icon: "table" as const },
  { label: "Deductions", href: "/payroll/deductions", icon: "deductions" as const },
  { label: "Payslip", href: "/payroll/payslip", icon: "payslip" as const },
  { label: "Bulk Payslip", href: "/payroll/bulk-payslip", icon: "stack" as const },
] satisfies { label: string; href: string; icon: IconName }[];

const DOCK_ITEMS = [
  { label: "People", href: "/employees", icon: "employees" as const },
  { label: "Shifts", href: "/shifts", icon: "shifts" as const },
  { label: "Payroll", href: "/payroll", icon: "payroll" as const },
  { label: "Settings", href: "/settings", icon: "settings" as const },
];

type IconName =
  | "employees"
  | "shifts"
  | "clock"
  | "settings"
  | "payroll"
  | "table"
  | "deductions"
  | "payslip"
  | "stack";

function HomeIcon({ name, className }: { name: IconName; className?: string }) {
  const path = ICON_PATHS[name];
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className ?? "h-7 w-7"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {Array.isArray(path)
        ? path.map((d, index) => <path key={`${name}-${index}`} d={d} />)
        : path && <path d={path} />}
    </svg>
  );
}

const ICON_PATHS: Record<IconName, string | string[]> = {
  employees:
    "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm8 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  shifts: ["M4 5h16M4 9h16M6 5v12M18 5v12M4 17h16"],
  clock: ["M12 7v5l3 1.5", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"],
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.6-3a7 7 0 0 0-.1-1l2.1-1.6-1.5-2.6-2.5 1a7 7 0 0 0-1.7-1l-.4-2.7h-3l-.4 2.7a7 7 0 0 0-1.7 1l-2.5-1-1.5 2.6 2.1 1.6a7 7 0 0 0 0 2l-2.1 1.6 1.5 2.6 2.5-1a7 7 0 0 0 1.7 1l.4 2.7h3l.4-2.7a7 7 0 0 0 1.7-1l2.5 1 1.5-2.6-2.1-1.6c.06-.33.1-.66.1-1Z",
  payroll: ["M4 6h16v12H4Z", "M8 6V4h8v2", "M8 11h8", "M8 15h5"],
  table: ["M3 7h18", "M3 12h18", "M3 17h18", "M8 7v10", "M16 7v10"],
  deductions: ["M5 5h14v14H5Z", "M9 9h6", "M9 13h3"],
  payslip: ["M6 4h9l5 5v11H6Z", "M15 4v5h5", "M9 13h6", "M9 17h6"],
  stack: ["M4 7 12 3l8 4-8 4-8-4Z", "m4 12 8 4 8-4", "m4 17 8 4 8-4"],
};

export default function HomePage() {
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const dockItems = useMemo<DockItem[]>(
    () =>
      DOCK_ITEMS.map((item) => ({
        ...item,
        icon: <HomeIcon name={item.icon} className="h-5 w-5" />,
      })),
    []
  );

  const getColumnCount = useCallback(() => {
    const grid = gridRef.current;
    const firstTile = tileRefs.current.find((tile): tile is HTMLAnchorElement => Boolean(tile));

    if (!grid || !firstTile) {
      return 1;
    }

    const gridStyles = window.getComputedStyle(grid);
    const gapValue = gridStyles.columnGap || gridStyles.gap || "0";
    const gap = parseFloat(gapValue);
    const gridWidth = grid.clientWidth;
    const tileWidth = firstTile.clientWidth;

    if (!tileWidth) {
      return 1;
    }

    const columns = Math.max(1, Math.floor((gridWidth + gap) / (tileWidth + gap)));
    return Math.min(columns, TILE_DEFINITIONS.length);
  }, []);

  const handleTileKeyDown = useCallback(
    (index: number) => (event: KeyboardEvent<HTMLAnchorElement>) => {
      const { key } = event;
      if (![`ArrowRight`, `ArrowLeft`, `ArrowUp`, `ArrowDown`].includes(key)) {
        return;
      }

      event.preventDefault();

      const columns = getColumnCount();
      const maxIndex = TILE_DEFINITIONS.length - 1;
      let nextIndex = index;

      switch (key) {
        case "ArrowRight":
          nextIndex = Math.min(index + 1, maxIndex);
          break;
        case "ArrowLeft":
          nextIndex = Math.max(index - 1, 0);
          break;
        case "ArrowDown":
          nextIndex = Math.min(index + columns, maxIndex);
          break;
        case "ArrowUp":
          nextIndex = Math.max(index - columns, 0);
          break;
      }

      const target = tileRefs.current[nextIndex];
      if (target) {
        target.focus();
      }
    },
    [getColumnCount]
  );

  return (
    <>
      <SplashScreen />
      <div className="relative flex min-h-dvh flex-col bg-[color-mix(in_srgb,_var(--agui-surface)_96%,_white_4%)] text-foreground">
        <div className="flex-1 pb-36">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-12 px-6 pt-12">
            <StatusHud className="w-full" />

            <header className="text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--agui-muted-foreground)]">Welcome back</p>
              <h1 className="mt-3 text-3xl font-semibold text-[var(--agui-on-surface)]">
                Launch the tools you need in seconds
              </h1>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                Open a module below or use Ctrl/Cmd + K to jump directly to a workflow.
              </p>
            </header>

            <section className="w-full">
              <h2 className="text-sm font-medium text-[var(--agui-muted-foreground)]">Apps</h2>
              <div
                ref={gridRef}
                className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
              >
                {TILE_DEFINITIONS.map((tile, index) => (
                  <AppTile
                    key={tile.href}
                    href={tile.href}
                    label={tile.label}
                    icon={<HomeIcon name={tile.icon} />}
                    onKeyDown={handleTileKeyDown(index)}
                    ref={(element) => {
                      tileRefs.current[index] = element;
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>

        <Dock items={dockItems} />
      </div>
    </>
  );
}
