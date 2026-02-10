import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HrAccessDenied } from "./access-denied";
import { HrTabs } from "./hr-tabs";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccess } from "@/lib/hr/access";
import { loadUiConfig } from "@/lib/ui-config";

const TABS = [
  { key: "employees", label: "Employees", path: "employees" },
  { key: "dtr", label: "DTR", path: "dtr" },
  { key: "schedules", label: "Schedules", path: "schedules" },
  { key: "payroll-preview", label: "Payroll Preview", path: "payroll-preview" },
  { key: "payroll-runs", label: "Payroll Runs", path: "payroll-runs" },
  { key: "payslips", label: "Payslips", path: "payslips" },
  { key: "kiosk-devices", label: "Kiosk Devices", path: "kiosk-devices" },
];

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export const metadata = { title: "HR" };

export default async function HrLayout({ children, params }: Props) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr`;
  const { supabase } = await requireAuth(basePath);

  const [{ data: house }, { flags }] = await Promise.all([
    supabase.from("houses").select("id, slug, name").eq("slug", slug).maybeSingle(),
    loadUiConfig(),
  ]);

  if (!house) {
    notFound();
  }

  const companyLabel = house.name ?? house.slug ?? house.id;
  const workspaceHref = house.slug ? `/company/${house.slug}` : `/company/${house.id}`;

  const hrEnabled = flags?.hr_enabled ?? true;
  if (!hrEnabled) {
    return renderLayout(
      <div className="rounded-2xl border border-dashed border-border bg-white/70 p-6 text-sm text-muted-foreground shadow-sm">
        HR is coming soon for this workspace.
      </div>,
      { name: companyLabel, href: workspaceHref },
    );
  }

  const access = await requireHrAccess(supabase, house.id);
  const tabs = TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: `${basePath}/${tab.path}`,
  }));

  if (!access.hasWorkspaceAccess) {
    return renderLayout(
      <HrAccessDenied
        title="You don’t have access to this workspace."
        description="HR data is restricted to workspace members. Ask an admin to add you before trying again."
      />,
      { name: companyLabel, href: workspaceHref },
    );
  }

  if (!access.allowed) {
    return renderLayout(
      <HrAccessDenied
        title="HR access required."
        description="Only workspace owners and managers can open HR. Please contact your admin to request access."
      />,
      { name: companyLabel, href: workspaceHref },
    );
  }

  return renderLayout(children, { name: companyLabel, href: workspaceHref }, tabs);
}

function Header({ name, href }: { name: string; href: string }) {
  return (
    <header className="space-y-1">
      <div className="text-sm text-muted-foreground">
        <Link href="/me" className="underline">Me</Link> → <Link href={href} className="underline">{name}</Link> → HR
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-foreground">HR</h1>
        <p className="text-sm text-muted-foreground">People, time & payroll for this workspace.</p>
      </div>
    </header>
  );
}

function renderLayout(body: ReactNode, header: { name: string; href: string }, tabs?: Tab[]) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <Header name={header.name} href={header.href} />
      {tabs && tabs.length > 0 ? <HrTabs tabs={tabs} /> : null}
      <div className="lg:min-w-0">{body}</div>
    </main>
  );
}

type Tab = { key: string; label: string; href: string };
