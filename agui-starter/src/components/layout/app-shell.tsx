"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

/* Inline SVG icons (no extra deps) */
function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 12l8-9 8 9v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8Z",
    users:
      "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm8 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    table: "M3 6h18M3 12h18M3 18h18M6 6v12M12 6v12M18 6v12",
    payroll: "M4 6h16v12H4zM8 6V4h8v2M8 10h8M8 14h5",
    menu: "M4 6h16M4 12h16M4 18h16",
    sun: "M12 4V2m0 20v-2M4.93 4.93 3.51 3.51m16.98 16.98-1.42-1.42M4 12H2m20 0h-2M4.93 19.07 3.51 20.49M19.07 4.93l1.42-1.42M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z",
    chevronLeft: "M15 18l-6-6 6-6",
    chevronRight: "M9 6l6 6-6 6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name] || ""} />
    </svg>
  );
}

type NavItem = { name: string; href: string; icon: string };

const NAV: NavItem[] = [
  { name: "Dashboard", href: "/", icon: "dashboard" },
  { name: "Employees", href: "/employees", icon: "users" },
  { name: "DTR Bulk", href: "/payroll/dtr-bulk", icon: "table" },
  { name: "Payroll", href: "/payroll", icon: "payroll" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // responsive + collapsible
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile
  const [collapsed, setCollapsed] = useState(false); // desktop collapse

  // dark mode: persist on <html data-theme="dark">
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const isDark = root.dataset.theme === "dark";
    setDark(isDark);
  }, []);
  const toggleDark = () => {
    const root = document.documentElement;
    const next = !dark;
    root.dataset.theme = next ? "dark" : "";
    setDark(next);
  };

  const nav = useMemo(() => NAV, []);

  return (
    <div className="min-h-screen flex bg-[var(--agui-surface)] text-[var(--agui-on-surface)] transition-colors">
      {/* Sidebar (desktop) */}
      <aside
        className={`hidden md:flex flex-col transition-all duration-200 shadow-soft border-r border-[color:var(--agui-surface-border)] bg-[var(--agui-surface-elevated)] ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-[var(--agui-radius)] bg-[var(--agui-primary)] text-[var(--agui-on-primary)] flex items-center justify-center font-bold">
              A
            </div>
            {!collapsed && (
              <div className="font-bold text-[var(--agui-on-surface)] text-lg leading-none">
                Agui
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 py-1"
            title={collapsed ? "Expand" : "Collapse"}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Icon
              name={collapsed ? "chevronRight" : "chevronLeft"}
              className="h-4 w-4"
            />
          </Button>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-[var(--agui-radius)] px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--agui-primary)] text-[var(--agui-on-primary)] shadow-soft"
                    : "text-[color-mix(in_srgb,_var(--agui-on-surface)_70%,_var(--agui-surface)_30%)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)] hover:text-[var(--agui-on-surface)]"
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4 opacity-80" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 mt-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={toggleDark}
          >
            <Icon name={dark ? "sun" : "moon"} className="h-4 w-4 mr-2" />
            {!collapsed && (dark ? "Light mode" : "Dark mode")}
          </Button>
        </div>
      </aside>

      {/* Sidebar (mobile drawer) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[var(--agui-surface-elevated)] text-[var(--agui-on-surface)] shadow-lifted p-3 border-r border-[color:var(--agui-surface-border)]">
            <div className="h-12 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-[var(--agui-radius)] bg-[var(--agui-primary)] text-[var(--agui-on-primary)] flex items-center justify-center font-bold">
                  A
                </div>
                <div className="font-bold text-[var(--agui-on-surface)] text-lg leading-none">
                  Agui
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2 py-1"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </Button>
            </div>
            <nav className="mt-3 space-y-1">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-[var(--agui-radius)] px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--agui-primary)] text-[var(--agui-on-primary)] shadow-soft"
                        : "text-[color-mix(in_srgb,_var(--agui-on-surface)_70%,_var(--agui-surface)_30%)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_12%,_transparent)] hover:text-[var(--agui-on-surface)]"
                    }`}
                  >
                    <Icon name={item.icon} className="h-4 w-4 opacity-80" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={toggleDark}
              >
                <Icon name={dark ? "sun" : "moon"} className="h-4 w-4 mr-2" />
                {dark ? "Light mode" : "Dark mode"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-14 border-b border-[color:var(--agui-surface-border)] bg-[var(--agui-surface-elevated)] text-[var(--agui-on-surface)] flex items-center justify-between px-3 md:px-6 shadow-soft">
          {/* Left: mobile menu */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 py-1 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm text-muted-foreground hidden md:inline">
              Agui Dashboard
            </span>
          </div>

          {/* Right: user stub */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleDark}
              title="Toggle theme"
            >
              <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,_var(--agui-on-surface)_12%,_transparent)] flex items-center justify-center text-sm text-[var(--agui-on-surface)]">
              U
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-[color-mix(in_srgb,_var(--agui-surface)_96%,_white_4%)]">
          {children}
        </main>
      </div>
    </div>
  );
}
