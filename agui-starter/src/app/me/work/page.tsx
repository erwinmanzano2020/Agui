// src/app/me/work/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";

export default async function MeWorkPage() {
  const supabase = await createServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) redirect("/welcome");

  const caps = await getCapabilitiesForUser(userId);

  if (caps.employeeBrands.length === 1) {
    redirect(`/brand/${caps.employeeBrands[0].slug}/employee`);
  }

  return (
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <h1 className="text-xl md:text-2xl font-semibold">My Workplace</h1>
      <ul className="mt-4 space-y-2">
        {caps.employeeBrands.map((b) => (
          <li key={b.slug}>
            <Link className="underline" href={`/brand/${b.slug}/employee`}>
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
      {caps.employeeBrands.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Wala ka pang linked workplace.
        </p>
      ) : null}
    </main>
  );
}
