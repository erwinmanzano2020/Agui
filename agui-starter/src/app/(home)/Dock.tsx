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

import { cn } from "@/lib/utils";
import { useTooltipPosition } from "@/hooks/use-tooltip-position";
import { resolveAccentPair } from "@/lib/color";

export type DockItem = {
  href: string;
  icon: ReactNode;
  label: string;
  accentColor?: string;
};

type DockButtonProps = {
  item: DockItem;
};

function DockButton({ item }: DockButtonProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const { ref: tooltipRef, inlineOffset } = useTooltipPosition<HTMLSpanElement>({
    open,
    contentKey: item.label,
  });

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  const handlePointerEnter = useCallback<PointerEventHandler<HTMLAnchorElement>>(
    (event) => {
      if (event.pointerType === "touch") {
        return;
      }
      show();
    },
    [show]
  );

  const handlePointerLeave = useCallback<PointerEventHandler<HTMLAnchorElement>>(
    (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      if (event.currentTarget === document.activeElement) {
        return;
      }

      hide();
    },
    [hide]
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
        aria-describedby={open ? tooltipId : undefined}
        style={accentStyle}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-[color-mix(in_srgb,_var(--agui-surface)_85%,_white_15%)]/90 text-[var(--dock-accent-contrast)] shadow-[0_20px_50px_-30px_color-mix(in_srgb,var(--dock-accent)_60%,_transparent)] backdrop-blur-xl transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--dock-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:color-mix(in_srgb,var(--agui-surface)_90%,var(--agui-on-surface)_10%)]",
          "hover:-translate-y-1 hover:shadow-[0_26px_60px_-36px_color-mix(in_srgb,var(--dock-accent)_60%,_black_40%)] active:translate-y-0 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[0_20px_50px_-30px_color-mix(in_srgb,var(--dock-accent)_60%,_transparent)] motion-reduce:transition-none"
        )}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {item.icon}
      </Link>

      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!open}
        ref={tooltipRef}
        style={{ marginLeft: inlineOffset }}
        className={cn(
          "pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[color-mix(in_srgb,_var(--agui-surface)_90%,_white_10%)]/95 px-3 py-1 text-xs font-medium text-[var(--agui-on-surface)] opacity-0 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.6)] backdrop-blur-xl transition-opacity duration-150 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {item.label}
      </span>
    </li>
  );
}

export function Dock({ items }: { items: DockItem[] }) {
  const visibleItems = items.slice(0, 6);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Home dock"
      className="fixed left-1/2 z-40 w-full max-w-[520px] -translate-x-1/2 px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <ul className="flex items-center justify-center gap-3 rounded-[32px] border border-white/10 bg-[color-mix(in_srgb,_var(--agui-surface)_78%,_white_22%)]/92 p-3 shadow-[0_32px_70px_-45px_rgba(15,23,42,0.7)] backdrop-blur-2xl">
        {visibleItems.map((item) => (
          <DockButton key={`${item.href}-${item.label}`} item={item} />
        ))}
      </ul>
    </nav>
  );
}
