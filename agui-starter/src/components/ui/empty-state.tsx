import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "agui-empty grid place-content-center rounded-[calc(var(--agui-radius)+6px)] border border-border bg-card/40 p-8 text-center shadow-soft",
        className
      )}
    >
      <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-[hsl(var(--agui-card-hsl))] ring-1 ring-[hsl(var(--agui-border-hsl))] grid place-content-center">
        <span className="text-xl opacity-80" aria-hidden>
          {icon ?? "🪄"}
        </span>
      </div>
      <div className="text-base font-semibold">{title}</div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-4 space-y-2 text-sm">{children}</div>}
      {actionLabel && onAction && (
        <Button className="mt-4" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
