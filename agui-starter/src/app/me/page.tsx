// src/app/me/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server";
import { getCapabilities } from "@/lib/roles/capabilities";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getServerSession();
  if (!session) redirect("/welcome");

  const user = session.user;
  const caps = await getCapabilities(user.id, user.email ?? undefined);

  // Example: keep everyone at /me but show simple cards as placeholders
  // (You can replace with your grid of AppTiles later.)
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Hi, {user.email ?? "there"} 👋</h1>
        <p className="opacity-70 text-sm">Your personal hub</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {/* Loyalty app is always present; if 1 brand, you may deep-link */}
        <a
          href={
            caps.loyaltyBrands.length === 1
              ? `/brand/${caps.loyaltyBrands[0].slug}/loyalty`
              : "/me/loyalty"
          }
          className="rounded-2xl border p-4 hover:shadow"
        >
          <div className="text-sm opacity-60">App</div>
          <div className="font-semibold">Loyalty Pass</div>
        </a>

        {/* Employee app if employed anywhere */}
        {caps.employeeOf.length > 0 && (
          <a href="/me/employee" className="rounded-2xl border p-4 hover:shadow">
            <div className="text-sm opacity-60">App</div>
            <div className="font-semibold">Employee</div>
          </a>
        )}

        {/* Owner app if owns businesses */}
        {caps.ownerOf.length > 0 && (
          <a href="/me/owner" className="rounded-2xl border p-4 hover:shadow">
            <div className="text-sm opacity-60">App</div>
            <div className="font-semibold">My Businesses</div>
          </a>
        )}

        {/* GM/admin */}
        {caps.isGM && (
          <a href="/me/gm" className="rounded-2xl border p-4 hover:shadow">
            <div className="text-sm opacity-60">App</div>
            <div className="font-semibold">GM Console</div>
          </a>
        )}
      </section>
    </main>
  );
}
