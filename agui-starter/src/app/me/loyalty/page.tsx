// src/app/me/loyalty/page.tsx
import { getServerSession } from "@/lib/auth/server";
import { getCapabilities } from "@/lib/roles/capabilities";
import Link from "next/link";

export default async function LoyaltyHub() {
  const session = await getServerSession();
  if (!session) return null;

  const caps = await getCapabilities(
    session.user.id,
    session.user.email ?? undefined
  );

  // If only one brand, deep-link to its pass page automatically
  if (caps.loyaltyBrands.length === 1) {
    const only = caps.loyaltyBrands[0];
    // Let app router do the redirect client-side via meta refresh
    return <meta httpEquiv="refresh" content={`0; url=/brand/${only.slug}/loyalty`} />;
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold mb-4">Your Loyalty Passes</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {caps.loyaltyBrands.map((b) => (
          <Link key={b.id} href={`/brand/${b.slug}/loyalty`} className="rounded-xl border p-4">
            {b.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
