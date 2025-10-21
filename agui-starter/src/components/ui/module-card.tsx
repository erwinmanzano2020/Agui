"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export function ModuleCard(props: {
  name: string;
  href: string;
  enabled: boolean;
  subtitle?: string;
}) {
  const { name, href, enabled, subtitle } = props;
  const content = (
    <div className="agui-rounded border border-border bg-card/60 p-4 shadow-soft transition-colors">
      <div className="text-sm opacity-70">{subtitle ?? "Module"}</div>
      <div className="text-xl font-semibold">{name}</div>
      <div className="mt-3">
        <Badge tone={enabled ? "on" : "off"}>{enabled ? "Open" : "Off"}</Badge>
      </div>
    </div>
  );

  if (!enabled) {
    return (
      <div className="opacity-60">
        {content}
        <div className="mt-2 text-xs opacity-70">
          Ask an admin to enable this in Settings → Modules.
        </div>
      </div>
    );
  }

  return (
    <Link href={href} className="hover:opacity-90 block">
      {content}
    </Link>
  );
}
