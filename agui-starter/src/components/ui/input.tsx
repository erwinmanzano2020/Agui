// agui-starter/src/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

// Use a type alias (not an empty interface extending another type)
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          // base styles — tweak to your design tokens if needed
          "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground",
          "shadow-sm outline-none transition-[border-color,box-shadow]",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
