import * as React from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "outline" | "ghost" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[calc(var(--agui-radius))] transition-[background-color,color,border,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:transform-none";

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 px-2.5 text-xs",
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

const variants: Record<ButtonVariant, string> = {
  solid:
    "border border-transparent bg-[var(--agui-primary)] text-[var(--agui-on-primary)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_88%,_black_12%)] active:scale-[0.99] focus-visible:shadow-[0_0_0_3px] focus-visible:shadow-[color-mix(in_srgb,_var(--ring)_35%,_transparent)] motion-reduce:active:scale-100",
  outline:
    "border text-[var(--agui-on-surface)] border-[color-mix(in_srgb,_var(--agui-card-border)_90%,_transparent)] bg-[var(--agui-card)] hover:border-[color-mix(in_srgb,_var(--agui-primary)_45%,_var(--agui-card-border)_55%)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_10%,_var(--agui-card)_90%)] active:scale-[0.99] motion-reduce:active:scale-100",
  ghost:
    "border border-transparent text-[var(--agui-on-surface)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)] active:scale-[0.99] motion-reduce:active:scale-100",
  link:
    "border border-transparent bg-transparent h-auto p-0 text-[var(--agui-primary)] underline-offset-4 hover:underline focus-visible:shadow-[0_0_0_3px] focus-visible:shadow-[color-mix(in_srgb,_var(--ring)_35%,_transparent)] motion-reduce:underline-offset-4",
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;

      if (typeof ref === "function") {
        ref(node);
        continue;
      }

      try {
        // MutableRefObject
        (ref as React.MutableRefObject<T | null>).current = node;
      } catch {
        // no-op; gracefully ignore refs we can't assign to
      }
    }
  };
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "solid",
      size = "md",
      asChild = false,
      children,
      type,
      ...props
    },
    ref
  ) => {
    const sizeClasses = variant === "link" ? "" : sizes[size];
    const composedClassName = cn(base, sizeClasses, variants[variant], className);

    if (asChild && React.isValidElement(children)) {
      const child = React.Children.only(children) as React.ReactElement<
        React.HTMLAttributes<HTMLElement>
      >;
      const existingClassName = isString(child.props?.className)
        ? child.props.className
        : undefined;
      const childRef = (child as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref;

      return React.cloneElement(child, {
        ...props,
        className: cn(composedClassName, existingClassName),
        ref: composeRefs(ref, childRef),
      });
    }

    return (
      <button
        ref={ref}
        className={composedClassName}
        type={type ?? "button"}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
