"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "agui:theme";

const ICONS: Record<string, string> = {
  sun: "M12 4V2m0 20v-2M4.93 4.93 3.51 3.51m16.98 16.98-1.42-1.42M4 12H2m20 0h-2M4.93 19.07 3.51 20.49M19.07 4.93l1.42-1.42M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z",
};

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
    root.dataset.theme = "dark";
  } else {
    root.classList.remove("dark");
    delete root.dataset.theme;
  }
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === "dark" || stored === "light"
      ? stored
      : root.classList.contains("dark") || root.dataset.theme === "dark"
        ? "dark"
        : "light";
    setMode(initial);
    applyTheme(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    applyTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, hydrated]);

  const label = useMemo(
    () => (mode === "dark" ? "Switch to light mode" : "Switch to dark mode"),
    [mode],
  );

  return (
    <button
      type="button"
      className="fixed left-3 bottom-3 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition hover:shadow-lifted"
      onClick={() => setMode((value) => (value === "dark" ? "light" : "dark"))}
      aria-label={label}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={ICONS[mode === "dark" ? "sun" : "moon"]} />
      </svg>
      <span>{mode === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
