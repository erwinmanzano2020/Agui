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
  useMemo,
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
  tile: string;
  icon: string;
  label: string;
  tooltip: string;
  tooltipText: string;
  ring: string;
  ringOffset: string;
  cssVars?: Record<string, string>;
};

const AUTO_TILE_VARS: Record<string, string> = {
  "--tile-border":
    "var(--launcher-tile-border, color-mix(in_srgb,var(--agui-card-border,_rgba(15,23,42,0.12))_80%,transparent_20%))",
  "--tile-background":
    "var(--launcher-tile-background, color-mix(in_srgb,var(--agui-card,_#f5f5f7)_92%,white_8%))",
  "--tile-foreground":
    "var(--launcher-tile-foreground, color-mix(in_srgb,var(--agui-on-surface,_#111827)_94%,white_6%))",
  "--tile-icon-border":
    "var(--launcher-icon-border, color-mix(in_srgb,var(--agui-card-border,_rgba(15,23,42,0.12))_70%,transparent_30%))",
  "--tile-icon-background":
    "var(--launcher-icon-background, color-mix(in_srgb,var(--tile-background)_88%,var(--tile-foreground)_12%))",
  "--tile-icon-color": "var(--launcher-icon-color, var(--tile-foreground))",
  "--tile-tooltip-border":
    "var(--launcher-tooltip-border, color-mix(in_srgb,var(--tile-border)_82%,transparent_18%))",
  "--tile-tooltip-background":
    "var(--launcher-tooltip-background, color-mix(in_srgb,var(--agui-surface,_#f8fafc)_92%,var(--tile-foreground)_8%))",
  "--tile-tooltip-color": "var(--launcher-tooltip-color, var(--tile-foreground))",
};

const VARIANT_STYLES: Record<AppTileVariant, VariantStyles> = {
  auto: {
    tile:
      "border border-[color:var(--tile-border)] bg-[color:var(--tile-background)] text-[color:var(--tile-foreground)] shadow-[0_22px_48px_-30px_color-mix(in_srgb,var(--tile-foreground)_20%,transparent)]",
    icon:
      "border border-[color:var(--tile-icon-border)] bg-[color:var(--tile-icon-background)] text-[color:var(--tile-icon-color)] shadow-[0_20px_40px_-28px_color-mix(in_srgb,var(--tile-foreground)_20%,transparent)]",
    label: "text-[color:var(--tile-foreground)]",
    tooltip:
      "border border-[color:var(--tile-tooltip-border)] bg-[color:var(--tile-tooltip-background)]",
    tooltipText: "text-[color:var(--tile-tooltip-color)]",
    ring: "var(--launcher-tile-ring, var(--agui-ring, rgba(59,130,246,0.32)))",
    ringOffset:
      "var(--launcher-tile-ring-offset, color-mix(in_srgb,var(--tile-background)_92%,white_8%))",
    cssVars: AUTO_TILE_VARS,
  },
  black: {
    tile:
      "border border-white/10 bg-neutral-950 text-white shadow-[0_22px_48px_-32px_rgba(0,0,0,0.75)]",
    icon:
      "border border-white/10 bg-neutral-950 text-white shadow-[0_20px_40px_-26px_rgba(0,0,0,0.75)]",
    label: "text-white",
    tooltip: "bg-white border-white/60",
    tooltipText: "text-neutral-900",
    ring: "rgba(255,255,255,0.55)",
    ringOffset: "rgba(11,11,15,0.9)",
  },
  pearl: {
    tile:
      "border border-neutral-200 bg-[#f5f5f7] text-neutral-900 shadow-[0_22px_45px_-30px_rgba(28,28,28,0.38)]",
    icon:
      "border border-neutral-200 bg-[#f5f5f7] text-neutral-900 shadow-[0_16px_30px_-24px_rgba(36,36,36,0.5)]",
    label: "text-neutral-900",
    tooltip: "bg-neutral-900 border-black/30",
    tooltipText: "text-white",
    ring: "rgba(28,28,28,0.45)",
    ringOffset: "#f5f5f7",
  },
  charcoal: {
    tile:
      "border border-white/12 bg-[#1f1f23] text-white shadow-[0_24px_52px_-34px_rgba(0,0,0,0.78)]",
    icon:
      "border border-white/12 bg-[#1f1f23] text-white shadow-[0_22px_46px_-30px_rgba(0,0,0,0.85)]",
    label: "text-white",
    tooltip: "bg-white border-white/50",
    tooltipText: "text-neutral-900",
    ring: "rgba(255,255,255,0.45)",
    ringOffset: "#1f1f23",
  },
  white: {
    tile:
      "border border-neutral-200 bg-white text-neutral-900 shadow-[0_22px_45px_-30px_rgba(36,36,36,0.24)]",
    icon:
      "border border-neutral-200 bg-white text-neutral-900 shadow-[0_22px_45px_-30px_rgba(36,36,36,0.24)]",
    label: "text-neutral-900",
    tooltip: "bg-neutral-900 border-black/20",
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
            "group flex w-full flex-col items-center gap-3 rounded-2xl text-center focus-visible:outline-none",
            styles.tile,
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
            if (event.pointerType === "touch" || !description) return;
            setTooltipVisible(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch") return;
            if (event.currentTarget === document.activeElement) {
              return;
            }
            setTooltipVisible(false);
          }}
          onFocus={(event) => {
            if (description) {
              setTooltipVisible(true);
            }
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setTooltipVisible(false);
            onBlur?.(event);
          }}
          onPointerDown={() => {
            setTooltipVisible(false);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
          }}
          aria-describedby={isTooltipVisible ? tooltipId : undefined}
        >
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl text-[color:inherit] transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0",
              "group-hover:scale-[1.03] group-active:scale-95",
              "motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100",
              styles.icon,
            )}
            aria-hidden
          >
            <span
              className={cn(
                LAUNCHER_DOCK_ICON_CLASS,
                "transition-transform duration-200 group-hover:scale-[1.08] group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100"
              )}
            >
              {enhancedIcon}
            </span>
          </span>
          <span
            className={cn(
              "block max-w-[9rem] min-h-[2.75rem] text-[13px] font-[450] leading-[1.35] tracking-wide text-balance text-center text-[color:inherit] break-words",

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
        {description ? (
          <div
            id={tooltipId}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-xs -translate-x-1/2 rounded-xl border px-3 py-1.5 text-xs shadow-[0_12px_30px_-20px_rgba(15,23,42,0.55)] transition-all duration-150 motion-reduce:translate-y-0 motion-reduce:transition-none motion-reduce:duration-0",
              styles.tooltip,
              styles.tooltipText,
              isTooltipVisible
                ? "translate-y-0 opacity-100"
                : "-translate-y-1 opacity-0",
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
