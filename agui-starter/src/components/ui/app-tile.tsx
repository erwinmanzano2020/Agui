"use client";

import Link from "next/link";
import {
  CSSProperties,
  cloneElement,
  forwardRef,
  isValidElement,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
  useMemo,
  useState,
} from "react";

import { LUCIDE_STROKE_WIDTH } from "@/components/icons/lucide";
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
    tile: string;
    icon: string;
    badge: string;
    label: string;
    description: string;
    tooltip: string;
    tooltipText: string;
    ring: string;
    ringOffset: string;
  }
> = {
  black: {
    tile:
      "border-white/10 bg-neutral-950 text-white shadow-[0_20px_45px_-30px_rgba(0,0,0,0.75)] hover:border-white/20",
    icon: "bg-white/10 text-white",
    badge: "bg-white/12 text-white",
    label: "text-white",
    description: "text-white/70",
    tooltip: "bg-white border-white/60",
    tooltipText: "text-neutral-900",
    ring: "rgba(255,255,255,0.55)",
    ringOffset: "#0b0b0f",
  },
  pearl: {
    tile:
      "border-white/60 bg-[#f5f5f7] text-neutral-900 shadow-[0_16px_35px_-32px_rgba(36,36,36,0.75)] hover:border-white/80",
    icon: "bg-white text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
    badge: "bg-neutral-900/10 text-neutral-900",
    label: "text-neutral-900",
    description: "text-neutral-600",
    tooltip: "bg-neutral-900 border-black/30",
    tooltipText: "text-white",
    ring: "rgba(28,28,28,0.45)",
    ringOffset: "#f5f5f7",
  },
  charcoal: {
    tile:
      "border-white/10 bg-[#1f1f23] text-white shadow-[0_24px_55px_-35px_rgba(0,0,0,0.85)] hover:border-white/15",
    icon: "bg-white/10 text-white",
    badge: "bg-white/12 text-white",
    label: "text-white",
    description: "text-white/65",
    tooltip: "bg-white border-white/50",
    tooltipText: "text-neutral-900",
    ring: "rgba(255,255,255,0.45)",
    ringOffset: "#1f1f23",
  },
  white: {
    tile:
      "border-neutral-200 bg-white text-neutral-900 shadow-[0_22px_50px_-32px_rgba(36,36,36,0.18)] hover:border-neutral-300",
    icon: "bg-neutral-950/5 text-neutral-900",
    badge: "bg-neutral-900/10 text-neutral-900",
    label: "text-neutral-900",
    description: "text-neutral-600",
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
    className: cn("h-6 w-6", element.props.className),
    strokeWidth:
      typeof element.props.strokeWidth === "number"
        ? Math.min(
            Math.max(element.props.strokeWidth, LUCIDE_STROKE_WIDTH - 0.2),
            LUCIDE_STROKE_WIDTH
          )
        : LUCIDE_STROKE_WIDTH,
    color: element.props.color ?? "currentColor",
  });
}

export const AppTile = forwardRef<HTMLAnchorElement, AppTileProps>(
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
            "group flex min-h-[132px] w-full flex-col gap-4 rounded-[28px] border px-5 py-6 transition duration-200 ease-out hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:var(--tile-ring)] focus-visible:[--tw-ring-offset-color:var(--tile-ring-offset)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:duration-0 motion-reduce:transform-none motion-reduce:hover:brightness-100 motion-reduce:active:scale-100",
            styles.tile,
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
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-[22px] text-[color:inherit] transition duration-200 motion-reduce:transition-none motion-reduce:duration-0",
                styles.icon,
              )}
              aria-hidden
            >
              <span className="text-current">{enhancedIcon}</span>
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide transition duration-200 motion-reduce:transition-none motion-reduce:duration-0",
                styles.badge,
              )}
            >
              App
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className={cn("text-lg font-medium", styles.label)}>{label}</p>
            <p className={cn("text-sm", styles.description)}>
              {description ? description : "Open app"}
            </p>
          </div>
        </Link>
        {description ? (
          <div
            id={tooltipId}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-max max-w-xs -translate-x-1/2 rounded-2xl border px-4 py-2 text-sm shadow-2xl transition-all duration-150 motion-reduce:translate-y-0 motion-reduce:transition-none motion-reduce:duration-0",
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

AppTile.displayName = "AppTile";
