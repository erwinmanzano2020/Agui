import type { ReactElement, ReactNode } from "react";

export type AppMeta = {
  id: string;
  label: string;
  href: string;
  description?: string;
  icon: ReactNode;
  accentColor?: string;
};

function createIcon(children: ReactNode): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {children}
    </svg>
  );
}

const employeesIcon = createIcon(
  <>
    <path d="M18 21v-2a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
    <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
  </>
);

const dtrIcon = createIcon(
  <>
    <path d="M21 7v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7" />
    <path d="M16 3v4" />
    <path d="M8 3v4" />
    <path d="M3 11h18" />
    <circle cx="16" cy="17" r="3" />
    <path d="M16 15v2l1.5 1.5" />
  </>
);

const payrollIcon = createIcon(
  <>
    <path d="M21 4H9a2 2 0 0 0-2 2v13" />
    <path d="M7 19a2 2 0 1 0 2 2h10a2 2 0 0 0 2-2V6" />
    <path d="M12 8h8" />
    <path d="M12 12h8" />
    <path d="M12 16h6" />
  </>
);

const importIcon = createIcon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M12 12v6" />
    <path d="M9 15l3 3 3-3" />
  </>
);

const settingsIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.5 12a7.5 7.5 0 0 0-.18-1.63l2.05-1.49-2-3.46-2.43 1a7.52 7.52 0 0 0-2.82-1.63L14 2h-4l-.12 2.79a7.52 7.52 0 0 0-2.82 1.63l-2.43-1-2 3.46 2.05 1.49A7.5 7.5 0 0 0 4.5 12c0 .55.06 1.09.18 1.63l-2.05 1.49 2 3.46 2.43-1a7.52 7.52 0 0 0 2.82 1.63L10 22h4l.12-2.79a7.52 7.52 0 0 0 2.82-1.63l2.43 1 2-3.46-2.05-1.49A7.5 7.5 0 0 0 19.5 12Z" />
  </>
);

export const apps: AppMeta[] = [
  {
    id: "employees",
    label: "Employees",
    href: "/employees",
    description: "Manage staff records",
    icon: employeesIcon,
    accentColor: "#2563EB",
  },
  {
    id: "dtr",
    label: "DTR Bulk",
    href: "/payroll/dtr-bulk",
    description: "Quick time entry",
    icon: dtrIcon,
    accentColor: "#F97316",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    description: "Runs & payslips",
    icon: payrollIcon,
    accentColor: "#16A34A",
  },
  {
    id: "imports",
    label: "Import CSV",
    href: "/imports",
    description: "Bulk upload",
    icon: importIcon,
    accentColor: "#0EA5E9",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings/appearance",
    description: "Theme & app config",
    icon: settingsIcon,
    accentColor: "#A855F7",
  },
];

export const dock: string[] = ["dtr", "employees", "payroll"];
