import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type ThemedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export function ThemedLink({ className, ...props }: ThemedLinkProps) {
  return (
    <Link
      className={cx(
        "text-[var(--agui-accent)]",
        "font-medium",
        "underline-offset-4",
        "hover:underline",
        "transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export default ThemedLink;
