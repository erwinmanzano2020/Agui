"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getInitialMode, setThemeMode, type ThemeMode } from "@/app/providers/theme-provider";

type ToggleProps = React.ComponentProps<typeof Button> & {
  /** show only icon (default true) */
  iconOnly?: boolean;
};

export default function ThemeToggle({ className, iconOnly = true, ...btnProps }: ToggleProps) {
  const [mode, setMode] = React.useState<ThemeMode>(() =>
    typeof window === "undefined" ? "light" : getInitialMode()
  );

  function flip() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    setThemeMode(next);
  }

  const label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={flip}
      aria-label={label}
      title={label}
      className={className}
      {...btnProps}
    >
      <span aria-hidden>{mode === "dark" ? "☀️" : "🌙"}</span>
      {!iconOnly && <span className="ml-2">{mode === "dark" ? "Light mode" : "Dark mode"}</span>}
    </Button>
  );
}
