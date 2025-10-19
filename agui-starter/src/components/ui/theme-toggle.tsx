// agui-starter/src/components/ui/theme-toggle.tsx
"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@/components/icons/lucide";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark";

function getSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function readInitialMode(): Mode {
  if (typeof window === "undefined") return "light";
  const saved = (localStorage.getItem("agui-theme") || "").toLowerCase();
  if (saved === "light" || saved === "dark") return saved as Mode;
  return getSystemPrefersDark() ? "dark" : "light";
}

function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement; // <html>
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem("agui-theme", mode);
  } catch {}
  // notify any listeners (optional)
  window.dispatchEvent(new CustomEvent("agui:theme", { detail: { mode } }));
}

type ThemeToggleProps = {
  iconOnly?: boolean;
} & Omit<ButtonProps, "onClick">;

export function ThemeToggle({ iconOnly = true, className, ...btnProps }: ThemeToggleProps) {
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("light");

  // Mount: read current + apply
  React.useEffect(() => {
    const m = readInitialMode();
    setMode(m);
    applyMode(m);
    setMounted(true);

    // Keep in sync with system changes if user didn't explicitly choose
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      const saved = localStorage.getItem("agui-theme");
      if (!saved) {
        const next = getSystemPrefersDark() ? "dark" : "light";
        setMode(next);
        applyMode(next);
      }
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  const flip = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyMode(next);
  };

  // Keep SSR output stable; switch icon/label after mount
  const effective = mounted ? mode : "light";
  const label = effective === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const icon = (
    <span
      aria-hidden
      className="relative inline-flex h-5 w-5 items-center justify-center"
      suppressHydrationWarning
    >
      <SunIcon
        className={cn(
          "transition-all duration-300",
          effective === "dark"
            ? "scale-0 opacity-0 rotate-90"
            : "scale-100 opacity-100 rotate-0"
        )}
      />
      <MoonIcon
        className={cn(
          "absolute transition-all duration-300",
          effective === "dark"
            ? "scale-100 opacity-100 rotate-0"
            : "scale-0 opacity-0 -rotate-90"
        )}
      />
    </span>
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={flip}
      className={className}
      aria-label={label}
      title={label}
      {...btnProps}
    >
      {icon}
      {!iconOnly && <span className="ml-2" suppressHydrationWarning>{label}</span>}
    </Button>
  );
}

export default ThemeToggle;
