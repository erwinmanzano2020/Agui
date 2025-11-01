// src/app/me/loyalty/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function LoyaltyHubPage() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const caps = await getCapabilitiesForUser(session.user.id);
  const brands = caps.loyaltyBrands;

  if (brands.length === 1) {
    redirect(`/brand/${brands[0].slug}/loyalty`);
  }

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold mb-3">Loyalty Pass</h1>
      {brands.length === 0 ? (
        <p className="opacity-75">No loyalty memberships yet.</p>
      ) : (
        <ul className="space-y-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brand/${b.slug}/loyalty`}
                className="inline-block rounded-lg border px-3 py-2 hover:shadow"
              >
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
