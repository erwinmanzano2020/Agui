// src/components/me/AppTile.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

type AppTileProps = {
  href: string;
  title: string;
  desc?: string;
  icon?: React.ReactNode;
  className?: string;
};

export function AppTile({ href, title, desc, icon, className }: AppTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-2xl border p-4 shadow-sm hover:shadow transition focus:outline-none focus:ring",
        "flex items-start gap-3 bg-white/80 dark:bg-neutral-900/80",
        className
      )}
    >
      {icon && <div className="mt-1">{icon}</div>}
      <div>
        <div className="text-base font-semibold">{title}</div>
        {desc && <div className="text-sm opacity-75">{desc}</div>}
      </div>
    </Link>
  );
}
