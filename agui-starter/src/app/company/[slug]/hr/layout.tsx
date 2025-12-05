import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HrTabs } from "./hr-tabs";
import { requireAuth } from "@/lib/auth/require-auth";
import { loadUiConfig } from "@/lib/ui-config";
import { resolveHrAccess } from "@/lib/hr/access";

const TABS = [
  { key: "employees", label: "Employees", path: "employees" },
  { key: "dtr", label: "DTR", path: "dtr" },
  { key: "payroll", label: "Payroll", path: "payroll" },
  { key: "payslips", label: "Payslips", path: "payslips" },
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
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <Header name={companyLabel} href={workspaceHref} />
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-6 text-sm text-muted-foreground shadow-sm">
          HR is coming soon for this workspace.
        </div>
      </main>
    );
  }

  const access = await resolveHrAccess(supabase, house.id);
  const tabs = TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: `${basePath}/${tab.path}`,
  }));

  const showTabs = access.allowed;
  let body: ReactNode = children;

  if (!access.hasWorkspaceAccess) {
    body = (
      <div className="rounded-2xl border border-border bg-white/70 p-6 text-sm text-muted-foreground shadow-sm">
        No access to this workspace.
      </div>
    );
  } else if (!access.allowed) {
    body = (
      <div className="rounded-2xl border border-border bg-white/70 p-6 text-sm text-muted-foreground shadow-sm">
        HR is not available for your role.
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <Header name={companyLabel} href={workspaceHref} />
      {showTabs ? <HrTabs tabs={tabs} /> : null}
      <div className="lg:min-w-0">{body}</div>
    </main>
  );
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
