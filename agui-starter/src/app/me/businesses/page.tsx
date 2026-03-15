// src/app/me/businesses/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function MyBusinessesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) redirect(`/welcome?next=${encodeURIComponent("/me/businesses")}`);

  const caps = await getCapabilitiesForUser(userId);

  if (caps.ownerBrands.length === 1) {
    redirect(`/brand/${caps.ownerBrands[0].slug}`);
  }

  return (
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <h1 className="text-xl md:text-2xl font-semibold">My Businesses</h1>
      <ul className="mt-4 space-y-2">
        {caps.ownerBrands.map((b) => (
          <li key={b.slug}>
            <Link className="underline" href={`/brand/${b.slug}`}>
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
      {caps.ownerBrands.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Wala ka pang businesses linked sa account mo.
        </p>
      ) : null}
    </main>
  );
}
