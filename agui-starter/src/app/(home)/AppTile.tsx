"use client";

import Link from "next/link";
import { forwardRef, type KeyboardEventHandler, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AppTileProps = {
  href: string;
  icon: ReactNode;
  label: string;
  description?: string;
  accent?: string;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
};

export const AppTile = forwardRef<HTMLAnchorElement, AppTileProps>(
  ({ href, icon, label, description, accent, onKeyDown }, ref) => {
    return (
      <Link
        href={href}
        ref={ref}
        onKeyDown={onKeyDown}
        className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-6 py-8 text-center text-sm shadow-soft transition-transform duration-150 hover:-translate-y-1 hover:shadow-lifted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--agui-primary)] active:scale-95"
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-[var(--agui-primary)] transition-transform duration-150 group-hover:scale-105",
            accent ?? "bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)]"
          )}
        >
          {icon}
        </span>
        <span className="w-full truncate text-base font-semibold text-[var(--agui-on-surface)]">
          {label}
        </span>
        {description ? (
          <span className="text-xs text-[var(--agui-muted-foreground)]">
            {description}
          </span>
        ) : null}
      </Link>
    );
  }
);

AppTile.displayName = "AppTile";
