// src/app/me/businesses/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function MyBusinesses() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const caps = await getCapabilitiesForUser(
    session.user.id,
    session.user.email ?? undefined
  );

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold mb-4">My Businesses</h1>
      {caps.ownerBrands.length === 0 ? (
        <p className="text-sm text-muted-foreground">No owned brands yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {caps.ownerBrands.map((b) => (
            <Link key={b.id} href={`/brand/${b.slug}`} className="rounded-xl border p-4">
              {b.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
