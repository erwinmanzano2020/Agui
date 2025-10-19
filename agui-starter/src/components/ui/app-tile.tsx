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

export type AppTileVariant = "black" | "pearl" | "charcoal" | "white";

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

const VARIANT_STYLES: Record<
  AppTileVariant,
  {
    icon: string;
    label: string;
    tooltip: string;
    tooltipText: string;
    ring: string;
    ringOffset: string;
  }
> = {
  black: {
    icon:
      "border border-white/10 bg-neutral-950 text-white shadow-[0_20px_40px_-26px_rgba(0,0,0,0.75)]",
    label: "text-white",
    tooltip: "bg-white border-white/60",
    tooltipText: "text-neutral-900",
    ring: "rgba(255,255,255,0.55)",
    ringOffset: "rgba(11,11,15,0.9)",
  },
  pearl: {
    icon:
      "border border-neutral-200 bg-[#f5f5f7] text-neutral-900 shadow-[0_16px_30px_-24px_rgba(36,36,36,0.5)]",
    label: "text-neutral-900",
    tooltip: "bg-neutral-900 border-black/30",
    tooltipText: "text-white",
    ring: "rgba(28,28,28,0.45)",
    ringOffset: "#f5f5f7",
  },
  charcoal: {
    icon:
      "border border-white/12 bg-[#1f1f23] text-white shadow-[0_22px_46px_-30px_rgba(0,0,0,0.85)]",
    label: "text-white",
    tooltip: "bg-white border-white/50",
    tooltipText: "text-neutral-900",
    ring: "rgba(255,255,255,0.45)",
    ringOffset: "#1f1f23",
  },
  white: {
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
      variant = "black",
      className,
      tabIndex,
      onFocus,
      onBlur,
      onKeyDown,
    },
    ref
  ) => {
    const styles = VARIANT_STYLES[variant];
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
            "group flex w-full flex-col items-center gap-3 text-center focus-visible:outline-none",
            className,
          )}
          style={
            {
              "--tile-ring": styles.ring,
              "--tile-ring-offset": styles.ringOffset,
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
              "group-focus-visible:ring-2 group-focus-visible:ring-[var(--tile-ring)] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--tile-ring-offset)]",
              styles.icon,
            )}
            style={
              {
                "--tile-ring": styles.ring,
                "--tile-ring-offset": styles.ringOffset,
              } as CSSProperties
            }
            aria-hidden
          >
            <span
              className={cn(
                LAUNCHER_DOCK_ICON_CLASS,
                "transition-transform duration-200 group-hover:scale-[1.08] group-active:scale-95"
              )}
            >
              {enhancedIcon}
            </span>
          </span>
          <span
            className={cn(
              "max-w-[8rem] text-sm font-medium leading-snug text-balance text-center text-[color:inherit]",
              styles.label,
            )}
            style={{
              WebkitLineClamp: 2,
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
