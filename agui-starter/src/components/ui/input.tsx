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
          "flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm",
          "shadow-sm outline-none transition-[border,box-shadow]",
          "placeholder:text-gray-400",
          "focus:border-gray-400 focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
