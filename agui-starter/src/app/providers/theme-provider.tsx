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
    const root = document.documentElement;
    const vars = themeToCssVars(theme);
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  return <>{children}</>;
}

export default ThemeProvider;
