"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useId,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { useTooltipPosition } from "@/hooks/use-tooltip-position";

export type AppTileProps = {
  href: string;
  icon: ReactNode;
  label: string;
  description?: string;
  accentColor?: string;
  tabIndex?: number;
  className?: string;
  onFocus?: FocusEventHandler<HTMLAnchorElement>;
  onBlur?: FocusEventHandler<HTMLAnchorElement>;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
};

export const AppTile = forwardRef<HTMLAnchorElement, AppTileProps>(
  (
    {
      href,
      icon,
      label,
      description,
      accentColor,
      tabIndex,
      className,
      onFocus,
      onBlur,
      onKeyDown,
    },
    ref
  ) => {
    const tooltipId = useId();
    const [isTooltipVisible, setTooltipVisible] = useState(false);
    const { ref: tooltipRef, inlineOffset } = useTooltipPosition<HTMLDivElement>({
      open: isTooltipVisible,
      contentKey: description ?? label,
    });

    const showTooltip = useCallback(() => {
      if (!description) {
        return;
      }
      setTooltipVisible(true);
    }, [description]);

    const hideTooltip = useCallback(() => {
      setTooltipVisible(false);
    }, []);

    const handleFocus: FocusEventHandler<HTMLAnchorElement> = useCallback(
      (event) => {
        showTooltip();
        onFocus?.(event);
      },
      [onFocus, showTooltip]
    );

    const handleBlur: FocusEventHandler<HTMLAnchorElement> = useCallback(
      (event) => {
        hideTooltip();
        onBlur?.(event);
      },
      [hideTooltip, onBlur]
    );

    const handlePointerEnter: PointerEventHandler<HTMLAnchorElement> = useCallback(
      (event) => {
        if (event.pointerType === "touch") {
          return;
        }
        showTooltip();
      },
      [showTooltip]
    );

    const handlePointerLeave: PointerEventHandler<HTMLAnchorElement> = useCallback(
      (event) => {
        if (event.pointerType === "touch") {
          return;
        }

        if (event.currentTarget === document.activeElement) {
          return;
        }

        hideTooltip();
      },
      [hideTooltip]
    );

    const handleKeyDown: KeyboardEventHandler<HTMLAnchorElement> = useCallback(
      (event) => {
        if (event.key === "Escape") {
          if (isTooltipVisible) {
            event.stopPropagation();
            hideTooltip();
          }
        } else if (event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          event.currentTarget.click();
        }

        onKeyDown?.(event);
      },
      [hideTooltip, isTooltipVisible, onKeyDown]
    );

    const ariaLabel = description ? `${label}. ${description}` : label;

    const accentColorValue = accentColor ?? "var(--agui-primary)";
    const accentStyle = {
      "--tile-accent": accentColorValue,
    } as CSSProperties;

    return (
      <div className="relative flex h-full w-full">
        <Link
          href={href}
          ref={ref}
          tabIndex={tabIndex}
          aria-label={ariaLabel}
          aria-describedby={description && isTooltipVisible ? tooltipId : undefined}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onKeyDown={handleKeyDown}
          style={accentStyle}
          className={cn(
            "group relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-[28px] border border-white/10 bg-[color-mix(in_srgb,_var(--agui-surface)_88%,_white_12%)]/90 px-6 py-8 text-center text-sm text-card-foreground shadow-[0_30px_60px_-40px_rgba(15,23,42,0.65)] backdrop-blur-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tile-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[rgba(15,23,42,0.08)] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
            "before:pointer-events-none before:absolute before:inset-px before:rounded-[26px] before:bg-[linear-gradient(150deg,rgba(255,255,255,0.22),rgba(255,255,255,0.04))] before:opacity-75 before:transition-opacity before:duration-200 motion-reduce:before:transition-none",
            "hover:-translate-y-1 hover:shadow-[0_32px_70px_-40px_color-mix(in_srgb,var(--tile-accent)_55%,_black_45%)] hover:before:opacity-100 active:translate-y-0",
            className
          )}
        >
          <span
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_30%_20%,_color-mix(in_srgb,var(--tile-accent)_35%,_transparent)_0%,_color-mix(in_srgb,var(--tile-accent)_5%,_transparent)_70%)] text-[color-mix(in_srgb,var(--tile-accent)_88%,_var(--agui-on-surface)_12%)] shadow-[0_26px_40px_-32px_color-mix(in_srgb,var(--tile-accent)_65%,_transparent)] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
              "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle,_rgba(255,255,255,0.25)_0%,_rgba(255,255,255,0)_65%)] after:opacity-0 after:transition-opacity after:duration-200 motion-reduce:after:transition-none",
              "group-hover:scale-[1.04] group-hover:after:opacity-100"
            )}
          >
            {icon}
          </span>
          <span className="w-full truncate text-base font-semibold text-card-foreground">
            {label}
          </span>
          {description ? (
            <span className="text-xs text-muted-foreground/90">{description}</span>
          ) : null}
        </Link>

        {description ? (
          <div
            id={tooltipId}
            role="tooltip"
            aria-hidden={!isTooltipVisible}
            className={cn(
              "pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-max max-w-xs -translate-x-1/2 rounded-xl border border-white/15 bg-[color-mix(in_srgb,_var(--agui-surface)_92%,_white_8%)]/95 px-3 py-2 text-xs text-card-foreground shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-opacity duration-150 motion-reduce:transition-none",
              isTooltipVisible ? "opacity-100" : "opacity-0"
            )}
            ref={tooltipRef}
            style={{ marginLeft: inlineOffset }}
          >
            {description}
          </div>
        ) : null}
      </div>
    );
  }
);

AppTile.displayName = "AppTile";
