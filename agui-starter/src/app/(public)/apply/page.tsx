"use client";

import Link from "next/link";

export default function ApplyLanding() {
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Apply</h1>
      <p className="text-sm text-muted-foreground">Choose how you want to get started.</p>
      <div className="grid gap-4">
        <Link href="/apply/employee" className="block rounded-2xl border p-4 transition hover:shadow-sm">
          <div className="font-medium">Apply as Employee</div>
          <div className="text-xs text-muted-foreground">Join a business as staff.</div>
        </Link>
        <Link href="/apply/business" className="block rounded-2xl border p-4 transition hover:shadow-sm">
          <div className="font-medium">Register a Business</div>
          <div className="text-xs text-muted-foreground">Create a brand and manage it.</div>
        </Link>
      </div>
    </main>
  );
}
