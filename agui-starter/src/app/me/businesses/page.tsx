// src/app/me/businesses/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function MyBusinesses() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const caps = await getCapabilitiesForUser(session.user.id);
  const brands = caps.ownerBrands;

  if (brands.length === 1) {
    redirect(`/brand/${brands[0].slug}`);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">My Businesses</h1>
        <p className="text-sm opacity-70">Select a brand to manage.</p>
      </header>

      {brands.length === 0 ? (
        <p className="opacity-75">No owned brands yet.</p>
      ) : (
        <ul className="space-y-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link href={`/brand/${b.slug}`} className="underline">
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
