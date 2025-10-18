"use client";

import Link from "next/link";
import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const HOVER_DELAY = 200;
const LONG_PRESS_DELAY = 350;

export interface AppTileProps {
  icon: ReactNode;
  label: string;
  href: string;
  description: string;
  accent?: string;
  className?: string;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
    } else {
      // Safari < 14 fallback
      // @ts-expect-error addListener is deprecated but still required for support.
      mediaQuery.addListener(update);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", update);
      } else {
        // @ts-expect-error removeListener is deprecated but still required for support.
        mediaQuery.removeListener(update);
      }
    };
  }, []);

  return prefersReducedMotion;
}

export function AppTile(props: AppTileProps) {
  const { icon, label, href, description, accent, className } = props;
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  const [isPopoverVisible, setPopoverVisible] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const tooltipId = useId();
  const popoverLabelId = useId();
  const popoverDescriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number>();
  const longPressTimeoutRef = useRef<number>();
  const longPressTriggeredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isPopoverVisible) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setPopoverVisible(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPopoverVisible(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverVisible]);

  useEffect(() => {
    if (isPopoverVisible) {
      setTooltipVisible(false);
    }
  }, [isPopoverVisible]);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
  }, []);

  const scheduleTooltip = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      hoverTimeoutRef.current = undefined;
      setTooltipVisible(true);
    }, HOVER_DELAY);
  };

  const cancelTooltip = (immediate = false) => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }
    if (immediate) {
      setTooltipVisible(false);
    }
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "touch") {
      return;
    }
    scheduleTooltip();
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "touch") {
      clearLongPressTimer();
      touchStartRef.current = null;
    }
    if (!isFocused) {
      cancelTooltip(true);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    scheduleTooltip();
  };

  const handleBlur = () => {
    setFocused(false);
    cancelTooltip(true);
    setPopoverVisible(false);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "touch") {
      setTooltipVisible(false);
      longPressTriggeredRef.current = false;
      if (longPressTimeoutRef.current) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
      longPressTimeoutRef.current = window.setTimeout(() => {
        longPressTimeoutRef.current = undefined;
        longPressTriggeredRef.current = true;
        setPopoverVisible(true);
        touchStartRef.current = null;
      }, LONG_PRESS_DELAY);
      touchStartRef.current = { x: event.clientX, y: event.clientY };
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = undefined;
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "touch") {
      clearLongPressTimer();
      touchStartRef.current = null;
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "touch") {
      clearLongPressTimer();
      touchStartRef.current = null;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }
    if (!touchStartRef.current) {
      return;
    }
    const dx = Math.abs(event.clientX - touchStartRef.current.x);
    const dy = Math.abs(event.clientY - touchStartRef.current.y);
    if (dx > 12 || dy > 12) {
      clearLongPressTimer();
      touchStartRef.current = null;
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      longPressTriggeredRef.current = false;
    }
    setTooltipVisible(false);
    setPopoverVisible(false);
  };

  const accentValue = accent ?? "var(--agui-ring)";
  const motionClasses = prefersReducedMotion
    ? ""
    : "transition-all duration-150 ease-out";
  const tooltipHiddenState = prefersReducedMotion
    ? "opacity-0"
    : "opacity-0 translate-y-1";
  const tooltipVisibleState = prefersReducedMotion
    ? "opacity-100"
    : "opacity-100 -translate-y-1";
  const popoverHiddenState = prefersReducedMotion
    ? "opacity-0"
    : "opacity-0 translate-y-1";
  const popoverVisibleState = prefersReducedMotion
    ? "opacity-100"
    : "opacity-100 translate-y-0";

  return (
    <div ref={containerRef} className="relative block w-full">
      <Link
        href={href}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        aria-describedby={isTooltipVisible ? tooltipId : undefined}
        className={cn(
          "group flex w-full flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 text-left shadow-soft transition-colors hover:border-border/60 hover:bg-card/90",
          "focus-visible:[outline:0] focus-visible:[box-shadow:0_0_0_3px_color-mix(in_srgb,var(--app-tile-accent, var(--agui-ring))_65%,transparent)]",
          className,
        )}
        style={{
          "--app-tile-accent": accentValue,
        } as CSSProperties}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-2xl text-foreground/90">{icon}</div>
          <span className="rounded-full bg-foreground/[0.08] px-2 py-1 text-xs font-medium text-foreground/70">
            App
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold text-foreground">{label}</div>
          <div className="text-sm text-muted-foreground">Tap to open</div>
        </div>
      </Link>

      <div
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isTooltipVisible}
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 z-50 w-max max-w-xs -translate-x-1/2 rounded-xl border border-border/80 bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg",
          motionClasses,
          isTooltipVisible ? tooltipVisibleState : tooltipHiddenState,
        )}
        style={{
          transformOrigin: "center bottom",
          marginTop: "-0.75rem",
        }}
      >
        {description}
      </div>

      <div
        role="dialog"
        aria-modal="false"
        aria-hidden={!isPopoverVisible}
        aria-labelledby={popoverLabelId}
        aria-describedby={popoverDescriptionId}
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-64 max-w-sm -translate-x-1/2 rounded-2xl border border-border/70 bg-background/98 p-4 text-sm text-foreground shadow-lg",
          motionClasses,
          isPopoverVisible ? popoverVisibleState : popoverHiddenState,
          isPopoverVisible ? "pointer-events-auto" : "",
        )}
      >
        <div id={popoverLabelId} className="text-sm font-medium text-foreground">
          {label}
        </div>
        <p id={popoverDescriptionId} className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
