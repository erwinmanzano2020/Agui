import type { HTMLAttributes } from "react";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[var(--agui-radius)]",
        "bg-[var(--agui-card)]",
        "text-[var(--agui-card-foreground)]",
        "border",
        "border-[color:var(--agui-card-border)]",
        "shadow-soft backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export default Card;
