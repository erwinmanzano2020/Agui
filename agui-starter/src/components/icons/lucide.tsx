import type { ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type LucideIconProps = SVGProps<SVGSVGElement>;

const DEFAULT_STROKE_WIDTH = 1.2;

function createLucideIcon(displayName: string, children: ReactNode) {
  const Component = ({ className, ...props }: LucideIconProps) => (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      strokeWidth={DEFAULT_STROKE_WIDTH}
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide-icon", className)}
      {...props}
    >
      {children}
    </svg>
  );

  Component.displayName = `${displayName}Icon`;

  return Component;
}

export { DEFAULT_STROKE_WIDTH as LUCIDE_STROKE_WIDTH };

export const LAUNCHER_DOCK_ICON_CLASS = "launcher-dock-icon";

export const UsersIcon = createLucideIcon(
  "Users",
  <>
    <path d="M18 21v-2a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
    <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
  </>
);

export const CalendarClockIcon = createLucideIcon(
  "CalendarClock",
  <>
    <path d="M21 7v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7" />
    <path d="M16 3v4" />
    <path d="M8 3v4" />
    <path d="M3 11h18" />
    <circle cx="16" cy="17" r="3" />
    <path d="M16 15v2l1.5 1.5" />
  </>
);

export const ScrollTextIcon = createLucideIcon(
  "ScrollText",
  <>
    <path d="M21 4H9a2 2 0 0 0-2 2v13" />
    <path d="M7 19a2 2 0 1 0 2 2h10a2 2 0 0 0 2-2V6" />
    <path d="M12 8h8" />
    <path d="M12 12h8" />
    <path d="M12 16h6" />
  </>
);

export const FileDownIcon = createLucideIcon(
  "FileDown",
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M12 12v6" />
    <path d="M9 15l3 3 3-3" />
  </>
);

export const SettingsIcon = createLucideIcon(
  "Settings",
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.5 12a7.5 7.5 0 0 0-.18-1.63l2.05-1.49-2-3.46-2.43 1a7.52 7.52 0 0 0-2.82-1.63L14 2h-4l-.12 2.79a7.52 7.52 0 0 0-2.82 1.63l-2.43-1-2 3.46 2.05 1.49A7.5 7.5 0 0 0 4.5 12c0 .55.06 1.09.18 1.63l-2.05 1.49 2 3.46 2.43-1a7.52 7.52 0 0 0 2.82 1.63L10 22h4l.12-2.79a7.52 7.52 0 0 0 2.82-1.63l2.43 1 2-3.46-2.05-1.49A7.5 7.5 0 0 0 19.5 12Z" />
  </>
);

export const LayoutDashboardIcon = createLucideIcon(
  "LayoutDashboard",
  <>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </>
);

export const MenuIcon = createLucideIcon(
  "Menu",
  <>
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </>
);

export const ChevronLeftIcon = createLucideIcon(
  "ChevronLeft",
  <polyline points="15 18 9 12 15 6" />
);

export const ChevronRightIcon = createLucideIcon(
  "ChevronRight",
  <polyline points="9 18 15 12 9 6" />
);

export const SunIcon = createLucideIcon(
  "Sun",
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>
);

export const MoonIcon = createLucideIcon(
  "Moon",
  <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
);
