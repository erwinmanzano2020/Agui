"use client";

import * as React from "react";
import { setThemeMode, getInitialMode, type ThemeMode } from "@/app/providers/theme-provider";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const [mode, setMode] = React.useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return getInitialMode();
  });

  function flip() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    setThemeMode(next);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="fixed left-3 bottom-3"
      onClick={flip}
    >
      {mode === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}
