"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ui/theme-toggle";
import {
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutDashboardIcon,
  MenuIcon,
  ScrollTextIcon,
  UsersIcon,
} from "@/components/icons/lucide";

type NavItem = { name: string; href: string; icon: ReactNode };

const NAV: NavItem[] = [
  { name: "Dashboard", href: "/", icon: <LayoutDashboardIcon className="h-5 w-5" /> },
  { name: "Employees", href: "/employees", icon: <UsersIcon className="h-5 w-5" /> },
  {
    name: "DTR Bulk",
    href: "/payroll/dtr-bulk",
    icon: <CalendarClockIcon className="h-5 w-5" />,
  },
  { name: "Payroll", href: "/payroll", icon: <ScrollTextIcon className="h-5 w-5" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // responsive + collapsible
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile
  const [collapsed, setCollapsed] = useState(false); // desktop collapse

  const nav = useMemo(() => NAV, []);

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors">
      {/* Sidebar (desktop) */}
      <aside
        className={`hidden md:flex flex-col transition-all duration-200 shadow-soft border-r border-border bg-card text-card-foreground ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-[var(--agui-radius)] bg-[var(--agui-primary)] text-[var(--agui-on-primary)] flex items-center justify-center font-bold">
              A
            </div>
            {!collapsed && (
              <div className="font-bold text-card-foreground text-lg leading-none">
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
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
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
                <span className="text-current opacity-80">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* removed legacy theme toggle in sidebar to avoid duplicates */}
        {/* Use the global ThemeToggle in layout instead */}
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
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-card text-card-foreground shadow-lifted p-3 border-r border-border">
            <div className="h-12 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-[var(--agui-radius)] bg-[var(--agui-primary)] text-[var(--agui-on-primary)] flex items-center justify-center font-bold">
                  A
                </div>
                <div className="font-bold text-card-foreground text-lg leading-none">
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
                    <span className="text-current opacity-80">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            {/* removed legacy mobile toggle; use the shared ThemeToggle in layout/header instead */}
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card text-card-foreground flex items-center justify-between px-3 md:px-6 shadow-soft">
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
              <MenuIcon className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm text-muted-foreground hidden md:inline">
              Agui Dashboard
            </span>
          </div>

          {/* Right: actions (theme + user) */}
          <div className="flex items-center gap-2">
            {/* icon-only shared toggle */}
            <ThemeToggle className="h-9 w-9 p-0 rounded-2xl" />
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
