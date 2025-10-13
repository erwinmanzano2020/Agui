"use client";

import Link from "next/link";

export function ModuleCard(props: {
  name: string;
  href: string;
  enabled: boolean;
  subtitle?: string;
}) {
  const { name, href, enabled, subtitle } = props;
  const content = (
    <div
      className="agui-rounded p-4 border transition-colors"
      style={{
        borderColor: "var(--agui-accent)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
      }}
    >
      <div className="text-sm opacity-70">{subtitle ?? "Module"}</div>
      <div className="text-xl font-semibold">{name}</div>
      <div
        className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 agui-rounded"
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid var(--agui-accent)",
        }}
      >
        {enabled ? "Open" : "Off"}
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
