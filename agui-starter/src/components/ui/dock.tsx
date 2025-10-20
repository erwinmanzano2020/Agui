"use client";

import Link from "next/link";
import {
  useCallback,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";

import { LAUNCHER_DOCK_ICON_CLASS } from "@/components/icons/lucide";
import { cn } from "@/lib/utils";
import { useTooltipPosition } from "@/hooks/use-tooltip-position";
import { resolveAccentPair } from "@/lib/color";

export type DockItem = {
  href: string;
  icon: ReactNode;
  label: string;
  accentColor?: string;
  /**
   * Optional tooltip content. When omitted the label will be used.
   * Pass `null` to disable the tooltip for the item entirely.
   */
  tooltip?: string | null;
};

export type DockProps = {
  items: DockItem[];
  /** Accessible label for the dock navigation element. */
  ariaLabel?: string;
  /** Additional classes applied to the outer nav element. */
  className?: string;
  /** Additional classes applied to the dock container element. */
  contentClassName?: string;
  /**
   * Toggle tooltip rendering for dock items. Tooltips are enabled by default
   * when there is tooltip content available for the item.
   */
  showTooltips?: boolean;
};

type DockButtonProps = {
  item: DockItem;
  showTooltips: boolean;
};

function DockButton({ item, showTooltips }: DockButtonProps) {
  const tooltipContent =
    item.tooltip === null ? null : item.tooltip ?? item.label;
  const hasTooltipContent =
    typeof tooltipContent === "string" && tooltipContent.length > 0;
  const enableTooltip = showTooltips && hasTooltipContent;

  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const { ref: tooltipRef, inlineOffset } = useTooltipPosition<HTMLSpanElement>({
    open: enableTooltip && open,
    contentKey: enableTooltip ? (tooltipContent as string) : undefined,
  });

  const show = useCallback(() => {
    if (enableTooltip) {
      setOpen(true);
    }
  }, [enableTooltip]);

  const hide = useCallback(() => {
    if (enableTooltip) {
      setOpen(false);
    }
  }, [enableTooltip]);

  const handlePointerEnter = useCallback<PointerEventHandler<HTMLAnchorElement>>(
    (event) => {
      if (!enableTooltip || event.pointerType === "touch") {
        return;
      }

      show();
    },
    [enableTooltip, show]
  );

  const handlePointerLeave = useCallback<PointerEventHandler<HTMLAnchorElement>>(
    (event) => {
      if (!enableTooltip || event.pointerType === "touch") {
        return;
      }

      if (event.currentTarget === document.activeElement) {
        return;
      }

      hide();
    },
    [enableTooltip, hide]
  );

  const handleFocus = useCallback<FocusEventHandler<HTMLAnchorElement>>(() => {
    show();
  }, [show]);

  const handleBlur = useCallback<FocusEventHandler<HTMLAnchorElement>>(() => {
    hide();
  }, [hide]);

  const { accent: accentColor, contrast: accentContrast } = useMemo(
    () => resolveAccentPair(item.accentColor, "var(--agui-primary)", "var(--agui-on-primary)"),
    [item.accentColor]
  );

  const accentStyle = {
    "--dock-accent": accentColor,
    "--dock-accent-contrast": accentContrast,
  } as CSSProperties;

  return (
    <li className="group relative flex basis-0 flex-1 justify-center">
      <Link
        href={item.href}
        aria-label={item.label}
        aria-describedby={enableTooltip && open ? tooltipId : undefined}
        style={accentStyle}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(15,17,23,0.08)] bg-[color:color-mix(in_srgb,_#ffffff_82%,_var(--dock-accent)_18%)] text-[color:color-mix(in_srgb,var(--dock-accent)_52%,_#0F1117_48%)] shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all",
          "hover:-translate-y-1 hover:shadow-[0_26px_60px_-36px_color-mix(in_srgb,var(--dock-accent)_65%,_rgba(15,17,23,0.45))] active:translate-y-0 motion-reduce:hover:translate-y-0 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--dock-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:rgba(238,241,246,0.92)]"
        )}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span className={cn(LAUNCHER_DOCK_ICON_CLASS, "drop-shadow-[0_1px_2px_rgba(15,17,23,0.22)]")}>{item.icon}</span>
      </Link>

      {enableTooltip ? (
        <span
          id={tooltipId}
          role="tooltip"
          aria-hidden={!open}
          ref={tooltipRef}
          style={{ marginLeft: inlineOffset }}
          className={cn(
            "pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[color-mix(in_srgb,_var(--agui-surface)_88%,_white_12%)]/95 px-3 py-1 text-xs font-medium text-[var(--agui-on-surface)] opacity-0 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.6)] backdrop-blur-xl transition-opacity duration-150 motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0"
          )}
        >
          {tooltipContent as string}
        </span>
      ) : null}
    </li>
  );
}

export function Dock({
  items,
  ariaLabel = "Application dock",
  className,
  contentClassName,
  showTooltips = true,
}: DockProps) {
  const visibleItems = items.slice(0, 6);

  if (visibleItems.length === 0) {
    return null;
  }

  const safeAreaBottom = "env(safe-area-inset-bottom, 0px)";
  const safeAreaInlineStart = "env(safe-area-inset-left, 0px)";
  const safeAreaInlineEnd = "env(safe-area-inset-right, 0px)";

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-x-0 z-50 flex justify-center",
        className
      )}
      style={{
        bottom: `calc(${safeAreaBottom} + 1rem)`,
        paddingLeft: `calc(${safeAreaInlineStart} + 1rem)`,
        paddingRight: `calc(${safeAreaInlineEnd} + 1rem)`,
        paddingBottom: safeAreaBottom,
      }}
    >
      <ul
        className={cn(
          "flex min-h-[5.25rem] w-full max-w-[540px] flex-nowrap items-center justify-center gap-3 rounded-[32px] border border-white/40 bg-[rgba(238,241,246,0.8)] px-5 py-4 shadow-[0_32px_70px_-45px_rgba(15,23,42,0.7)] backdrop-blur-2xl",
          "ring-1 ring-inset ring-[rgba(15,17,23,0.1)]",
          contentClassName
        )}
      >
        {visibleItems.map((item) => (
          <DockButton key={`${item.href}-${item.label}`} item={item} showTooltips={showTooltips} />
        ))}
      </ul>
    </nav>
  );
}
