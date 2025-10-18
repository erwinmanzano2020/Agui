"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DockItem = {
  href: string;
  icon: ReactNode;
  label: string;
  accent?: string;
};

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
          <li
            key={`${item.href}-${item.label}`}
            className="group relative flex basis-0 flex-1 justify-center"
          >
            <Link
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-[var(--agui-primary)] transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--agui-primary)] hover:scale-105 active:scale-95",
                item.accent ?? "bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)]"
              )}
            >
              {item.icon}
            </Link>

            <span
              role="tooltip"
              aria-hidden="true"
              className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color-mix(in_srgb,_var(--agui-surface)_90%,_black_10%)] px-3 py-1 text-xs font-medium text-[var(--agui-on-surface)] opacity-0 shadow-soft transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
