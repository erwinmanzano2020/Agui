"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useId,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type AppTileProps = {
  href: string;
  icon: ReactNode;
  label: string;
  description?: string;
  accent?: string;
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
      accent,
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
          className={cn(
            "group relative flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-center text-sm text-card-foreground shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agui-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color-mix(in_srgb,_var(--agui-surface)_92%,_black_8%)] hover:shadow-lifted active:scale-95 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none motion-reduce:active:scale-100",
            className
          )}
        >
          <span
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-[var(--agui-primary)] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              accent ?? "bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)]"
            )}
          >
            {icon}
          </span>
          <span className="w-full truncate text-base font-semibold text-card-foreground">
            {label}
          </span>
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
        </Link>

        {description ? (
          <div
            id={tooltipId}
            role="tooltip"
            aria-hidden={!isTooltipVisible}
            className={cn(
              "pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-max max-w-xs -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-soft transition-opacity duration-150 motion-reduce:transition-none",
              isTooltipVisible ? "opacity-100" : "opacity-0"
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
    );
  }
);

AppTile.displayName = "AppTile";
