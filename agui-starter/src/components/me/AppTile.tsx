// src/components/me/AppTile.tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppTileProps = {
  href: string;
  title: string;
  desc?: string;
  icon?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

export default function AppTile({
  href,
  title,
  desc,
  icon,
  className,
  ...rest
}: AppTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow bg-white/70 dark:bg-black/30",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
        className,
      )}
      {...rest}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          <div className="text-base md:text-lg font-semibold leading-tight">
            {title}
          </div>
          {desc ? (
            <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
          ) : null}
        </div>
        <div
          aria-hidden
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          →
        </div>
      </div>
    </Link>
  );
}
