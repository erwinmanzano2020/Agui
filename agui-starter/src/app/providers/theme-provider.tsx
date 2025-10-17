"use client";

import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import type { ThemeConfig } from "@/lib/ui-config";
import { themeToCssVars } from "@/lib/theme-css";

export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "agui:theme";

/** Read the initial mode from localStorage or prefers-color-scheme. */
export function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/** Public helper so UI can flip the theme and persist it. */
export function setThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
  applyMode(mode);
}

type ThemeProviderProps = PropsWithChildren<{
  /** Optional theme config; when provided we write CSS vars to :root */
  theme?: ThemeConfig;
}>;

/**
 * ThemeProvider:
 * - applies dark/light class using persisted preference
 * - listens to storage changes across tabs
 * - writes CSS vars from optional ThemeConfig
 */
export default function ThemeProvider({ theme, children }: ThemeProviderProps) {
  // Dark/light bootstrap + cross-tab sync
  useEffect(() => {
    applyMode(getInitialMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        applyMode(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Apply CSS variables from ThemeConfig (if passed)
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const vars = themeToCssVars(theme);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, String(v)));
  }, [theme]);

  return <>{children}</>;
}
