"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getInitialMode, setThemeMode, type ThemeMode } from "@/app/providers/theme-provider";

export default function ThemeToggle() {
  const [mode, setMode] = React.useState<ThemeMode>(() =>
    typeof window === "undefined" ? "light" : getInitialMode()
  );

  function flip() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    setThemeMode(next); // persists + flips html.dark
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="fixed left-3 bottom-3 z-50"
      onClick={flip}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mode === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}
