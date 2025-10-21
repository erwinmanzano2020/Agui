import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "on" | "off" | "warn" | "error";

export function Badge({
  className,
  children,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  const toneClass =
    tone === "on"
      ? "bg-[color-mix(in_hsl,_hsl(var(--agui-accent-hsl))_18%,_transparent)] text-[hsl(var(--agui-fg-hsl))] border-[hsl(var(--agui-border-hsl))]"
      : tone === "off"
        ? "bg-transparent text-[hsl(var(--agui-muted-fg-hsl, var(--agui-fg-hsl)))] border-[hsl(var(--agui-border-hsl))] opacity-80"
        : tone === "warn"
          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
          : tone === "error"
            ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
            : "bg-[hsl(var(--agui-card-hsl))] text-[hsl(var(--agui-fg-hsl))] border-[hsl(var(--agui-border-hsl))]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[10px] border px-2 py-0.5 text-[11px] font-medium leading-5",
        toneClass,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
