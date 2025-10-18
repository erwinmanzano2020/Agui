"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type DockItem = {
  href: string;
  icon: ReactNode;
  label: string;
};

export function Dock({ items }: { items: DockItem[] }) {
  return (
    <nav
      aria-label="Home dock"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-5 pt-3"
    >
      <div className="mx-auto w-full max-w-[520px] px-5">
        <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-soft backdrop-blur">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium text-[var(--agui-muted-foreground)] transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--agui-primary)] hover:text-[var(--agui-on-surface)] active:scale-95"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)] text-[var(--agui-primary)]">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
