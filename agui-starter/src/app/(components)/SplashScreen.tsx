"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { StatusHudApiResponse } from "@/lib/types/status";

const SPLASH_STORAGE_KEY = "agui.sawSplash";
const AUTO_DISMISS_DELAY = 1400;
const EXIT_ANIMATION_DURATION = 500;

function extractPlayerName(response: StatusHudApiResponse): string | null {
  if (!response.ok) return null;
  const name = response.data?.user?.displayName?.trim();
  return name ? name : null;
}

export function SplashScreen() {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [playerName, setPlayerName] = useState<string>("Player");

  const exitTimeoutRef = useRef<number>();
  const autoDismissTimeoutRef = useRef<number>();
  const hasFinishedRef = useRef(false);

  const finish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    if (autoDismissTimeoutRef.current) {
      window.clearTimeout(autoDismissTimeoutRef.current);
      autoDismissTimeoutRef.current = undefined;
    }
    setIsVisible(false);
    exitTimeoutRef.current = window.setTimeout(() => {
      setShouldRender(false);
    }, EXIT_ANIMATION_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        window.clearTimeout(exitTimeoutRef.current);
      }
      if (autoDismissTimeoutRef.current) {
        window.clearTimeout(autoDismissTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SPLASH_STORAGE_KEY)) return;

    sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    setShouldRender(true);
  }, []);

  useEffect(() => {
    if (!shouldRender) return;

    let isActive = true;
    fetch("/api/status", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as StatusHudApiResponse;
        return json;
      })
      .then((json) => {
        if (!isActive) return;
        const extracted = json ? extractPlayerName(json) : null;
        if (extracted) {
          setPlayerName(extracted);
        }
      })
      .catch(() => {
        // Swallow errors – splash should still render with the fallback name.
      });

    return () => {
      isActive = false;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const id = window.setTimeout(() => {
      setIsVisible(true);
    }, 20);
    return () => window.clearTimeout(id);
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    autoDismissTimeoutRef.current = window.setTimeout(() => {
      finish();
    }, AUTO_DISMISS_DELAY);

    const handleSkip = () => finish();
    window.addEventListener("keydown", handleSkip, { once: false });
    window.addEventListener("pointerdown", handleSkip, { once: false });

    return () => {
      if (autoDismissTimeoutRef.current) {
        window.clearTimeout(autoDismissTimeoutRef.current);
        autoDismissTimeoutRef.current = undefined;
      }
      window.removeEventListener("keydown", handleSkip);
      window.removeEventListener("pointerdown", handleSkip);
    };
  }, [finish, shouldRender]);

  const greeting = useMemo(() => `Welcome, ${playerName}!`, [playerName]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      role="presentation"
      onClick={finish}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background",
        "transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-6 pointer-events-none"
      )}
    >
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-[var(--agui-muted-foreground)]">
          Welcome
        </p>
        <h1 className="text-3xl font-semibold text-[var(--agui-on-surface)] sm:text-4xl">
          {greeting}
        </h1>
        <p className="text-sm text-[var(--agui-muted-foreground)]">
          Loading your mission control…
        </p>
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--agui-muted)]/30">
        <span
          className={cn(
            "block h-full w-full origin-left bg-primary",
            "transition-transform duration-[1400ms] ease-out",
            isVisible ? "scale-x-100" : "scale-x-0"
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}
