"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { SplashScreen } from "@/app/(components)/SplashScreen";
import { Dock, type DockItem } from "@/components/ui/dock";
import { AppTile } from "@/components/ui/app-tile";
import { apps, dock, type AppMeta } from "@/config/apps";

const APPS = apps;
const APPS_BY_ID = new Map<string, AppMeta>(APPS.map((app) => [app.id, app]));
const GRID_APPS = APPS;
const DOCK_APPS = dock
  .map((id) => APPS_BY_ID.get(id))
  .filter((entry): entry is AppMeta => Boolean(entry));

type TileHandlers = {
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => void;
};

export default function HomePage() {
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [columnCount, setColumnCount] = useState(1);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const dockItems = useMemo<DockItem[]>(() => {
    return DOCK_APPS.map((app) => ({
      href: app.href,
      label: app.label,
      icon: app.icon,
      accentColor: app.accentColor,
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
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const updateColumnCount = () => {
      setColumnCount(getColumnCount());
    };

    if (typeof ResizeObserver === "undefined") {
      updateColumnCount();
      window.addEventListener("resize", updateColumnCount);
      return () => {
        window.removeEventListener("resize", updateColumnCount);
      };
    }

    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(grid);
    updateColumnCount();

    return () => {
      observer.disconnect();
    };
  }, [getColumnCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const updateKeyboardVisibility = () => {
      const heightDiff = window.innerHeight - viewport.height;
      const isNarrowViewport = viewport.width <= 768;
      setIsKeyboardVisible(isNarrowViewport && heightDiff > 120);
    };

    viewport.addEventListener("resize", updateKeyboardVisibility);
    viewport.addEventListener("scroll", updateKeyboardVisibility);
    updateKeyboardVisibility();

    return () => {
      viewport.removeEventListener("resize", updateKeyboardVisibility);
      viewport.removeEventListener("scroll", updateKeyboardVisibility);
    };
  }, []);

  const safeAreaBottom = "env(safe-area-inset-bottom, 0px)";
  const safeAreaInlineStart = "env(safe-area-inset-left, 0px)";
  const safeAreaInlineEnd = "env(safe-area-inset-right, 0px)";
  const dockHeight = "5rem";
  const dockHintGap = "1.5rem";
  const hintBottomOffset = `calc(${safeAreaBottom} + ${dockHeight} + ${dockHintGap})`;

  const tileHandlers: TileHandlers[] = useMemo(() => {
    return GRID_APPS.map((_, index) => {
      const moveFocus = (nextIndex: number) => {
        const maxIndex = GRID_APPS.length - 1;
        const targetIndex = Math.min(Math.max(nextIndex, 0), maxIndex);

        setFocusIndex((current) => (current === targetIndex ? current : targetIndex));

        const target = tileRefs.current[targetIndex];
        if (!target) {
          return;
        }

        const activeElement = typeof document === "undefined" ? null : document.activeElement;
        if (activeElement === target) {
          return;
        }

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            target.focus();
          });
        } else {
          target.focus();
        }
      };

      const onFocus = () => {
        setFocusIndex((current) => (current === index ? current : index));
      };

      const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
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

        switch (key) {
          case "ArrowRight":
            moveFocus(index + 1);
            break;
          case "ArrowLeft":
            moveFocus(index - 1);
            break;
          case "ArrowDown":
            moveFocus(index + columns);
            break;
          case "ArrowUp":
            moveFocus(index - columns);
            break;
          case "Home":
            moveFocus(0);
            break;
          case "End":
            moveFocus(GRID_APPS.length - 1);
            break;
        }
      };

      return { onFocus, onKeyDown } satisfies TileHandlers;
    });
  }, [getColumnCount]);

  return (
    <>
      <SplashScreen />
      <div className="relative flex min-h-dvh flex-col bg-[color-mix(in_srgb,_var(--agui-surface)_96%,_white_4%)] text-foreground">
        <div className="flex-1 pb-44">
          <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-6 pt-12">
            <div className="flex flex-1 flex-col items-center gap-12">
              <header className="sr-only">
                <h1>App launcher</h1>
              </header>

              <section className="w-full flex flex-col items-center">
                <div
                  ref={gridRef}
                  role="grid"
                  aria-label="App launcher"
                  aria-colcount={columnCount}
                  aria-rowcount={Math.ceil(GRID_APPS.length / columnCount)}
                  className="grid grid-cols-3 justify-items-center gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
                >
                  {GRID_APPS.map((app, index) => (
                    <div
                      key={app.id}
                      role="gridcell"
                      aria-rowindex={Math.floor(index / columnCount) + 1}
                      aria-colindex={(index % columnCount) + 1}
                      className="flex justify-center items-start"
                    >
                      <AppTile
                        href={app.href}
                        label={app.label}
                        description={app.description}
                        icon={app.icon}
                        tabIndex={focusIndex === index ? 0 : -1}
                        onFocus={tileHandlers[index]?.onFocus}
                        onKeyDown={tileHandlers[index]?.onKeyDown}
                        className="w-full max-w-[9.5rem]"
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
        </div>

        {!isKeyboardVisible ? (
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-[112px] rounded-full border border-black/10 bg-white/40 px-3 py-1.5 text-xs text-[#1B1C1F]/60 backdrop-blur"
            style={{
              bottom: hintBottomOffset,
              paddingLeft: `calc(${safeAreaInlineStart} + 0.75rem)`,
              paddingRight: `calc(${safeAreaInlineEnd} + 0.75rem)`,
            }}
          >
            Launch the tools you need in seconds. Use <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>K</kbd>
          </div>
        ) : null}

        <Dock items={dockItems} />
      </div>
    </>
  );
}
