import type { ReactNode } from "react";

import ThemeToggle from "@/components/ui/theme-toggle";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color-mix(in_srgb,_var(--agui-surface)_96%,_white_4%)] text-foreground flex flex-col">
      <header className="h-14 text-[var(--agui-on-surface)] flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[var(--agui-radius)] bg-[var(--agui-primary)] text-[var(--agui-on-primary)] flex items-center justify-center font-bold">
            A
          </div>
          <span className="font-semibold text-sm text-muted-foreground">
            Home
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="h-9 w-9 p-0 rounded-2xl" />
          <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,_var(--agui-on-surface)_12%,_transparent)] flex items-center justify-center text-sm text-[var(--agui-on-surface)]">
            U
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
