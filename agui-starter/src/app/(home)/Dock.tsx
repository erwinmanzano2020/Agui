"use client";

import Link from "next/link";
import {
  useCallback,
  useState,
  type FocusEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { useTooltipPosition } from "@/hooks/use-tooltip-position";

export type DockItem = {
  href: string;
  icon: ReactNode;
  label: string;
  accent?: string;
};

type DockButtonProps = {
  item: DockItem;
};

function DockButton({ item }: DockButtonProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <li className="group relative flex basis-0 flex-1 justify-center">
      <Link
        href={item.href}
        aria-label={item.label}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-[var(--agui-primary)] transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--agui-primary)] hover:scale-105 active:scale-95",
          item.accent ?? "bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)]"
        )}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {item.icon}
      </Link>

      <span
        role="tooltip"
        aria-hidden={!open}
        ref={tooltipRef}
        style={{ marginLeft: inlineOffset }}
        className={cn(
          "pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color-mix(in_srgb,_var(--agui-surface)_90%,_black_10%)] px-3 py-1 text-xs font-medium text-[var(--agui-on-surface)] opacity-0 shadow-soft transition-opacity duration-150",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {item.label}
      </span>
    </li>
  );
}

export function Dock({ items }: { items: DockItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Home dock"
      className="fixed left-1/2 z-40 w-full max-w-[520px] -translate-x-1/2 px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <ul className="flex items-center justify-center gap-2 rounded-3xl border border-border/70 bg-[color-mix(in_srgb,_var(--agui-surface)_82%,_transparent)] p-2 shadow-soft backdrop-blur">
        {items.map((item) => (
          <DockButton key={`${item.href}-${item.label}`} item={item} />
        ))}
      </ul>
    </nav>
  );
}
