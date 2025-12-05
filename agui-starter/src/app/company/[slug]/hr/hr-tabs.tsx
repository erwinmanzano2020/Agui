"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type HrTab = {
  key: string;
  label: string;
  href: string;
};

type Props = {
  tabs: HrTab[];
};

export function HrTabs({ tabs }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "rounded-t-xl px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
