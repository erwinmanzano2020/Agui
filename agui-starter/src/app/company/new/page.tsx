import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createHouse } from "./actions";

export default function NewCompanyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Create a business</h1>
        <p className="text-sm text-muted-foreground">
          Launch a new workspace for your team. You’ll become the first manager automatically.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <form action={createHouse} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="company-name" className="text-sm font-medium text-foreground">
              Business name
            </label>
            <Input
              id="company-name"
              name="name"
              placeholder="Vangie Variety Store"
              required
              autoComplete="organization"
            />
            <p className="text-xs text-muted-foreground">
              This name appears on dashboards, reports, and staff tools.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="company-slug" className="text-sm font-medium text-foreground">
              Workspace URL (optional)
            </label>
            <Input id="company-slug" name="slug" placeholder="vangie-variety-store" autoComplete="off" />
            <p className="text-xs text-muted-foreground">
              Leave blank and we’ll generate one from the name.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="company-logo" className="text-sm font-medium text-foreground">
              Logo URL (optional)
            </label>
            <Input
              id="company-logo"
              name="logo"
              placeholder="https://example.com/logo.png"
              autoComplete="url"
              inputMode="url"
            />
            <p className="text-xs text-muted-foreground">
              Add a logo to personalize your workspace later. You can change this anytime.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Link href="/me" className="text-sm font-medium text-primary hover:underline">
              Cancel
            </Link>
            <Button type="submit" className="min-w-[140px]">
              Create workspace
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
