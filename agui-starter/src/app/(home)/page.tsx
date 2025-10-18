"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SplashScreen } from "@/app/(components)/SplashScreen";
import { Dock, type DockItem } from "@/app/(home)/Dock";
import { AppTile } from "@/app/(home)/AppTile";
import { apps, dock, type AppMeta } from "@/config/apps";

const APPS = apps;
const APPS_BY_ID = new Map<string, AppMeta>(APPS.map((app) => [app.id, app]));
const GRID_APPS = APPS;
const DOCK_APPS = dock
  .map((id) => APPS_BY_ID.get(id))
  .filter((entry): entry is AppMeta => Boolean(entry));

export default function HomePage() {
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [columnCount, setColumnCount] = useState(1);

  const dockItems = useMemo<DockItem[]>(() => {
    return DOCK_APPS.map((app) => ({
      href: app.href,
      label: app.label,
      icon: app.icon,
      accent: app.accent,
    }));
  }, []);

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
    return Math.min(columns, GRID_APPS.length);
  }, []);

  useEffect(() => {
    const updateColumnCount = () => {
      setColumnCount(getColumnCount());
    };

    updateColumnCount();

    window.addEventListener("resize", updateColumnCount);

    return () => {
      window.removeEventListener("resize", updateColumnCount);
    };
  }, [getColumnCount]);

  const handleTileKeyDown = useCallback(
    (index: number) => (event: KeyboardEvent<HTMLAnchorElement>) => {
      const { key } = event;
      if (
        ![
          "ArrowRight",
          "ArrowLeft",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(key)
      ) {
        return;
      }

      event.preventDefault();

      const columns = getColumnCount();
      const maxIndex = GRID_APPS.length - 1;
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
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = maxIndex;
          break;
      }

      if (nextIndex !== index) {
        setFocusIndex(nextIndex);
      }

      const target = tileRefs.current[nextIndex];
      if (target) {
        target.focus();
      }
    },
    [getColumnCount]
  );

  const handleTileFocus = useCallback(
    (index: number) => () => {
      if (focusIndex !== index) {
        setFocusIndex(index);
      }
    },
    [focusIndex]
  );

  return (
    <>
      <SplashScreen />
      <div className="relative flex min-h-dvh flex-col bg-[color-mix(in_srgb,_var(--agui-surface)_96%,_white_4%)] text-foreground">
        <div className="flex-1 pb-36">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-12 px-6 pt-12">
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
                role="grid"
                aria-label="App launcher"
                aria-colcount={columnCount}
                aria-rowcount={Math.ceil(GRID_APPS.length / columnCount)}
                className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
              >
                {GRID_APPS.map((app, index) => (
                  <div
                    key={app.id}
                    role="gridcell"
                    aria-rowindex={Math.floor(index / columnCount) + 1}
                    aria-colindex={(index % columnCount) + 1}
                    className="flex"
                  >
                    <AppTile
                      href={app.href}
                      label={app.label}
                      description={app.description}
                      icon={app.icon}
                      accent={app.accent}
                      tabIndex={focusIndex === index ? 0 : -1}
                      onFocus={handleTileFocus(index)}
                      onKeyDown={handleTileKeyDown(index)}
                      className="w-full"
                      ref={(element) => {
                        tileRefs.current[index] = element;
                      }}
                    />
                  </div>
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
