"use client";

import { PropsWithChildren, useEffect } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "agui:theme";

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

export default function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    // 1) apply initial
    applyMode(getInitialMode());

    // 2) respond to external storage changes (another tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        applyMode(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <>{children}</>;
}

// helper you can call from anywhere (client) to set and apply
export function setThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
  applyMode(mode);
}
