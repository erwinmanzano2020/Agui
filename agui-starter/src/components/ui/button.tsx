import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "outline" | "ghost" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[calc(var(--agui-radius))] transition-[background-color,color,border,box-shadow,transform] focus-visible:outline-none";

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 px-2.5 text-xs",
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

const variants: Record<ButtonVariant, string> = {
  solid:
    "text-white border border-transparent bg-[hsl(var(--agui-primary-hsl))] hover:bg-[color-mix(in_hsl,_hsl(var(--agui-accent-hsl))_50%,_hsl(var(--agui-primary-hsl)))] active:scale-[0.99] focus-visible:shadow-[0_0_0_3px] focus-visible:shadow-[color-mix(in_hsl,_hsl(var(--agui-ring-hsl))_35%,_transparent)]",
  outline:
    "border text-[hsl(var(--agui-fg-hsl))] border-[hsl(var(--agui-border-hsl))] bg-[hsl(var(--agui-card-hsl))] hover:border-[color-mix(in_hsl,_hsl(var(--agui-accent-hsl))_55%,_hsl(var(--agui-border-hsl)))] hover:bg-[color-mix(in_hsl,_hsl(var(--agui-accent-hsl))_10%,_transparent)] active:scale-[0.99]",
  ghost:
    "border border-transparent text-[hsl(var(--agui-fg-hsl))] hover:bg-[color-mix(in_hsl,_hsl(var(--agui-accent-hsl))_10%,_transparent)] active:scale-[0.99]",
  link:
    "border border-transparent bg-transparent h-auto p-0 text-[hsl(var(--agui-primary-hsl))] underline-offset-4 hover:underline focus-visible:shadow-[0_0_0_3px] focus-visible:shadow-[color-mix(in_hsl,_hsl(var(--agui-ring-hsl))_35%,_transparent)]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "solid", size = "md", ...props }, ref) => {
    // For link-style, ignore the height/padding from sizes unless the caller overrides via className
    const sizeClasses = variant === "link" ? "" : sizes[size];
    return (
      <button
        ref={ref}
        className={cn(base, sizeClasses, variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
