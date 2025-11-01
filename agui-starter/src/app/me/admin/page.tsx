// src/app/me/admin/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function AdminHubPage() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const caps = await getCapabilitiesForUser(session.user.id);
  if (!caps.isGM) {
    redirect("/me");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Admin (GM)</h1>
        <p className="text-sm opacity-70">Platform controls for game masters.</p>
      </header>

      <div>
        <Link href="/admin" className="underline">
          Open the Admin Console
        </Link>
      </div>
    </main>
  );
}
