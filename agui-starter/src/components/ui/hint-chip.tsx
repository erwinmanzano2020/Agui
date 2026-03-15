"use client";

import * as React from "react";

export function HintChip({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    setIsDesktop(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    mediaQuery.addEventListener?.("change", listener);

    return () => {
      mediaQuery.removeEventListener?.("change", listener);
    };
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
      {children}
    </div>
  );
}
