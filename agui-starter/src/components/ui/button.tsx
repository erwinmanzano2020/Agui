"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost" | "link" | "danger";
type ButtonSize = "xs" | "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    const sizes: Record<ButtonSize, string> = {
      xs: "px-2 py-1 text-xs",
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-5 py-3 text-base",
    };

    const base =
      "inline-flex items-center justify-center font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--agui-surface)] disabled:opacity-60 disabled:pointer-events-none";
    const radius = "rounded-[var(--agui-radius)]";

    const variantClass: Record<ButtonVariant, string> = {
      primary:
        "bg-[var(--agui-primary)] text-[var(--agui-on-primary)] shadow-soft hover:shadow-lifted",
      ghost: cx(
        "border",
        "border-[color:color-mix(in_srgb,_var(--agui-surface-border)_60%,_transparent)]",
        "bg-[color-mix(in_srgb,_var(--agui-surface)_92%,_var(--agui-on-surface)_8%)]",
        "text-[var(--agui-on-surface)]",
        "hover:bg-[color-mix(in_srgb,_var(--agui-surface)_86%,_var(--agui-on-surface)_14%)]",
      ),
      link:
        "bg-transparent px-0 py-0 text-[var(--agui-accent)] underline underline-offset-4 focus-visible:ring-0 focus-visible:ring-offset-0 hover:opacity-80",
      danger:
        "bg-[#dc2626] text-white hover:bg-[#b91c1c] focus-visible:ring-[#fecaca]",
    };

    const sizeClass = variant === "link" ? "text-sm" : sizes[size];

    return (
      <button
        ref={ref}
        className={cx(base, radius, sizeClass, variantClass[variant], className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export default Button;
