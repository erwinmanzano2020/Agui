// src/app/me/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";
import Link from "next/link";

export default async function MePage() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const userId = session.user.id;
  const caps = await getCapabilitiesForUser(userId);

  if (caps.loyaltyBrands.length === 1) {
    redirect(`/brand/${caps.loyaltyBrands[0].slug}/loyalty`);
  }

  if (caps.employeeBrands.length === 1) {
    redirect(`/brand/${caps.employeeBrands[0].slug}/employee`);
  }

  if (caps.ownerBrands.length === 1) {
    redirect(`/brand/${caps.ownerBrands[0].slug}`);
  }

  const hasLoyalty = caps.loyaltyBrands.length > 0;
  const hasEmployment = caps.employeeBrands.length > 0;
  const hasBusinesses = caps.ownerBrands.length > 0;
  const hasAdmin = caps.isGM;
  const hasAnyTile = hasLoyalty || hasEmployment || hasBusinesses || hasAdmin;

  return (
    <main className="mx-auto max-w-4xl p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Me</h1>
        <p className="text-sm opacity-70">Your personal hub.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {hasLoyalty && (
          <Link
            href="/me/loyalty"
            className="rounded-2xl border p-4 shadow transition hover:shadow-md"
          >
            <div className="text-lg font-medium">Loyalty Pass</div>
            <div className="text-sm opacity-70">
              {caps.loyaltyBrands.length} brand
              {caps.loyaltyBrands.length > 1 ? "s" : ""}
            </div>
          </Link>
        )}

        {hasEmployment && (
          <Link
            href="/me/employment"
            className="rounded-2xl border p-4 shadow transition hover:shadow-md"
          >
            <div className="text-lg font-medium">My Employment</div>
            <div className="text-sm opacity-70">
              {caps.employeeBrands.length} brand
              {caps.employeeBrands.length > 1 ? "s" : ""}
            </div>
          </Link>
        )}

        {hasBusinesses && (
          <Link
            href="/me/businesses"
            className="rounded-2xl border p-4 shadow transition hover:shadow-md"
          >
            <div className="text-lg font-medium">My Businesses</div>
            <div className="text-sm opacity-70">
              {caps.ownerBrands.length} brand
              {caps.ownerBrands.length > 1 ? "s" : ""}
            </div>
          </Link>
        )}

        {hasAdmin && (
          <Link
            href="/me/admin"
            className="rounded-2xl border p-4 shadow transition hover:shadow-md"
          >
            <div className="text-lg font-medium">Admin (GM)</div>
            <div className="text-sm opacity-70">Global controls &amp; settings</div>
          </Link>
        )}
      </div>

      {!hasAnyTile && (
        <p className="opacity-70">
          Walang apps pa for you. Try enrolling in a Loyalty Pass or ask your employer to add you.
        </p>
      )}
    </main>
  );
}
