// src/app/me/loyalty/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function MeLoyaltyPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) redirect(`/welcome?next=${encodeURIComponent("/me/loyalty")}`);

  const caps = await getCapabilitiesForUser(userId);

  if (caps.loyaltyBrands.length === 1) {
    redirect(`/brand/${caps.loyaltyBrands[0].slug}/loyalty`);
  }

  return (
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <h1 className="text-xl md:text-2xl font-semibold">My Loyalty Passes</h1>
      <ul className="mt-4 space-y-2">
        {caps.loyaltyBrands.map((b) => (
          <li key={b.slug}>
            <Link className="underline" href={`/brand/${b.slug}/loyalty`}>
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
      {caps.loyaltyBrands.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Wala ka pang loyalty passes. Enroll to start earning points.
        </p>
      ) : null}
    </main>
  );
}
