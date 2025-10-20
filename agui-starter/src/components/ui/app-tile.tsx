"use client";

import Link from "next/link";
import {
  CSSProperties,
  cloneElement,
  forwardRef,
  isValidElement,
  memo,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LAUNCHER_DOCK_ICON_CLASS,
  LUCIDE_STROKE_WIDTH,
} from "@/components/icons/lucide";
import { cn } from "@/lib/utils";

export type AppTileVariant = "auto" | "black" | "pearl" | "charcoal" | "white";

export interface AppTileProps {
  icon: ReactNode;
  label: string;
  href: string;
  description?: string;
  variant?: AppTileVariant;
  className?: string;
  tabIndex?: number;
  onFocus?: FocusEventHandler<HTMLAnchorElement>;
  onBlur?: FocusEventHandler<HTMLAnchorElement>;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
}

type VariantStyles = {
  icon: string;
  label: string;
  tooltip: string;
  tooltipText: string;
  ring: string;
  ringOffset: string;
  cssVars?: Record<string, string>;
};

const AUTO_TILE_VARS: Record<string, string> = {
  "--tile-foreground": "var(--launcher-tile-foreground, #1b1c1f)",
  "--tile-icon-border": "var(--launcher-icon-border, rgba(15,17,23,0.1))",
  "--tile-icon-background": "var(--launcher-icon-background, #eef1f6)",
  "--tile-icon-color": "var(--launcher-icon-color, #1b1c1f)",
  "--tile-tooltip-border": "var(--launcher-tooltip-border, rgba(148,163,184,0.35))",
  "--tile-tooltip-background":
    "var(--launcher-tooltip-background, rgba(15,23,42,0.78))",
  "--tile-tooltip-color": "var(--launcher-tooltip-color, #f8fafc)",
};

const VARIANT_STYLES: Record<AppTileVariant, VariantStyles> = {
  auto: {
    icon:
      "border border-[color:var(--tile-icon-border)] bg-[color:var(--tile-icon-background)] text-[color:var(--tile-icon-color)] shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)]",
    label: "text-[color:var(--tile-foreground)]",
    tooltip:
      "border border-[color:var(--tile-tooltip-border)] bg-[color:var(--tile-tooltip-background)]",
    tooltipText: "text-[color:var(--tile-tooltip-color)]",
    ring: "var(--launcher-tile-ring, var(--agui-ring, rgba(59,130,246,0.32)))",
    ringOffset: "var(--launcher-tile-ring-offset, #eef1f6)",
    cssVars: AUTO_TILE_VARS,
  },
  black: {
    icon:
      "border border-white/10 bg-neutral-950 text-white shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
    label: "text-white",
    tooltip: "border-white/20 bg-neutral-950/80",
    tooltipText: "text-white",
    ring: "rgba(255,255,255,0.55)",
    ringOffset: "rgba(11,11,15,0.9)",
  },
  pearl: {
    icon:
      "border border-neutral-200 bg-[#f5f5f7] text-neutral-900 shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)]",
    label: "text-neutral-900",
    tooltip: "border-white/25 bg-neutral-950/80",
    tooltipText: "text-white",
    ring: "rgba(28,28,28,0.45)",
    ringOffset: "#f5f5f7",
  },
  charcoal: {
    icon:
      "border border-white/12 bg-[#1f1f23] text-white shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
    label: "text-white",
    tooltip: "border-white/20 bg-neutral-950/80",
    tooltipText: "text-white",
    ring: "rgba(255,255,255,0.45)",
    ringOffset: "#1f1f23",
  },
  white: {
    icon:
      "border border-neutral-200 bg-white text-neutral-900 shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)]",
    label: "text-neutral-900",
    tooltip: "border-white/25 bg-neutral-950/80",
    tooltipText: "text-white",
    ring: "rgba(28,28,28,0.45)",
    ringOffset: "#ffffff",
  },
};

function enhanceIcon(icon: ReactNode): ReactNode {
  if (!isValidElement(icon)) {
    return icon;
  }

  const element = icon as ReactElement<{ className?: string; strokeWidth?: number; color?: string }>;

  return cloneElement(element, {
    className: cn(element.props.className),
    strokeWidth:
      typeof element.props.strokeWidth === "number"
        ? element.props.strokeWidth
        : LUCIDE_STROKE_WIDTH,
    color: element.props.color ?? "currentColor",
  });
}

const AppTileBase = forwardRef<HTMLAnchorElement, AppTileProps>(
  (
    {
      icon,
      label,
      href,
      description,
      variant = "auto",
      className,
      tabIndex,
      onFocus,
      onBlur,
      onKeyDown,
    },
    ref
  ) => {
    const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.auto;
    const [isTooltipVisible, setTooltipVisible] = useState(false);
    const [isCoarsePointer, setIsCoarsePointer] = useState(() => {
      if (typeof window === "undefined") {
        return false;
      }

      return window.matchMedia("(pointer: coarse)").matches;
    });
    const showTimerRef = useRef<number | null>(null);

    const shouldRenderTooltip = Boolean(description) && !isCoarsePointer;

    const clearShowTimer = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const showTooltip = () => {
      if (!shouldRenderTooltip) {
        return;
      }

      clearShowTimer();
      showTimerRef.current = window.setTimeout(() => {
        setTooltipVisible(true);
        showTimerRef.current = null;
      }, 120);
    };

    const hideTooltip = () => {
      clearShowTimer();
      setTooltipVisible(false);
    };

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const mediaQuery = window.matchMedia("(pointer: coarse)");
      const update = () => setIsCoarsePointer(mediaQuery.matches);

      update();

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", update);
        return () => {
          mediaQuery.removeEventListener("change", update);
        };
      }

      mediaQuery.addListener(update);
      return () => {
        mediaQuery.removeListener(update);
      };
    }, []);

    useEffect(() => {
      if (!isCoarsePointer) {
        return;
      }

      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      setTooltipVisible(false);
    }, [isCoarsePointer]);

    useEffect(() => {
      return () => {
        if (showTimerRef.current !== null) {
          window.clearTimeout(showTimerRef.current);
        }
      };
    }, []);

    const enhancedIcon = useMemo(() => enhanceIcon(icon), [icon]);
    const tooltipId = description
      ? `${label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}-tooltip`
      : undefined;

    return (
      <div className="relative inline-block">
        <Link
          href={href}
          ref={ref}
          tabIndex={tabIndex}
          className={cn(
            "group flex w-full flex-col items-center gap-3 text-center focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-[color:var(--tile-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--tile-ring-offset)]",
            className,
          )}
          style={
            {
              "--tile-ring": styles.ring,
              "--tile-ring-offset": styles.ringOffset,
              ...(styles.cssVars ?? {}),
            } as CSSProperties
          }
          onPointerEnter={(event) => {
            if (event.pointerType === "touch") {
              return;
            }
            showTooltip();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch") return;
            if (event.currentTarget === document.activeElement) {
              return;
            }
            hideTooltip();
          }}
          onFocus={(event) => {
            showTooltip();
            onFocus?.(event);
          }}
          onBlur={(event) => {
            hideTooltip();
            onBlur?.(event);
          }}
          onPointerDown={() => {
            hideTooltip();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
          }}
          aria-describedby={isTooltipVisible && shouldRenderTooltip ? tooltipId : undefined}
        >
          <span
            className={cn(
              "flex h-[60px] w-[60px] items-center justify-center rounded-[20px] text-[color:inherit] transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0",
              "group-active:scale-[0.97] motion-reduce:group-active:scale-100",
              styles.icon,
            )}
            aria-hidden
          >
            <span className={LAUNCHER_DOCK_ICON_CLASS}>{enhancedIcon}</span>
          </span>
          <span
            className={cn(
              "block max-w-[9rem] min-h-[2.75rem] text-[13px] font-medium leading-[1.35] tracking-wide text-balance text-center break-words",
              styles.label,
            )}
            style={{
              WebkitLineClamp: 2,
              lineClamp: 2,
              WebkitBoxOrient: "vertical",
              display: "-webkit-box",
              overflow: "hidden",
            }}
          >
            {label}
          </span>
        </Link>
        {shouldRenderTooltip ? (
          <div
            id={tooltipId}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-[10px] border px-3 py-1.5 text-xs shadow-[0_20px_45px_-25px_rgba(2,6,23,0.75)] backdrop-blur-lg transition-all duration-150 motion-reduce:translate-y-0 motion-reduce:transition-none motion-reduce:duration-0",
              styles.tooltip,
              styles.tooltipText,
              isTooltipVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
            aria-hidden={!isTooltipVisible}
          >
            {description}
          </div>
        ) : null}
      </div>
    );
  }
);

AppTileBase.displayName = "AppTile";

export const AppTile = memo(
  AppTileBase,
  (prev, next) => {
    return (
      prev.href === next.href &&
      prev.label === next.label &&
      prev.description === next.description &&
      prev.variant === next.variant &&
      prev.className === next.className &&
      prev.tabIndex === next.tabIndex &&
      prev.onFocus === next.onFocus &&
      prev.onBlur === next.onBlur &&
      prev.onKeyDown === next.onKeyDown
    );
  }
);

AppTile.displayName = "AppTile";
