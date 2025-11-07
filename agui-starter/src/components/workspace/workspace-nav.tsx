"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceSection } from "@/lib/tiles/types";

type Props = {
  companyLabel: string;
  sections: WorkspaceSection[];
};

function isActiveRoute(pathname: string | null, target: string): boolean {
  if (!pathname) {
    return false;
  }
  if (pathname === target) {
    return true;
  }
  return pathname.startsWith(`${target}/`);
}

export function WorkspaceNav({ companyLabel, sections }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-full max-w-xs rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
        <div className="text-lg font-semibold text-foreground">{companyLabel}</div>
      </div>
      <nav className="space-y-1">
        {sections.map((section) => {
          const active = isActiveRoute(pathname, section.defaultRoute);
          return (
            <Link
              key={section.key}
              href={section.defaultRoute}
              className={`flex flex-col rounded-xl border p-3 text-sm transition ${
                active
                  ? "border-primary/60 bg-primary/5 text-primary"
                  : "border-transparent text-foreground hover:border-border hover:bg-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="font-medium">{section.label}</span>
              {section.badges && section.badges.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {section.badges.map((badge) => `${badge.key}: ${badge.value}`).join(" • ")}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
