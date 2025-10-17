"use client";

import { useEffect } from "react";
import type { ThemeConfig } from "@/lib/ui-config";
import { themeToCssVars } from "@/lib/theme-css";

type ThemeProviderProps = {
  theme: ThemeConfig;
  children: React.ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    const vars = themeToCssVars(theme);

    const ALLOW = new Set([
      "--agui-primary",
      "--agui-primary-hsl",
      "--agui-accent",
      "--agui-accent-hsl",
      "--agui-ring",
      "--agui-ring-hsl",
      "--agui-radius",
    ]);

    for (const [key, value] of Object.entries(vars)) {
      if (ALLOW.has(key)) {
        root.style.setProperty(key, String(value));
      }
    }
  }, [theme]);

  return <>{children}</>;
}

export default ThemeProvider;
