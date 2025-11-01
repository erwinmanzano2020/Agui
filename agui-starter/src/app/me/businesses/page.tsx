// src/app/me/businesses/page.tsx
import { getServerSession } from "@/lib/auth/server";
import { getCapabilities } from "@/lib/roles/capabilities";
import Link from "next/link";

export default async function MyBusinesses() {
  const session = await getServerSession();
  if (!session) return null;

  const caps = await getCapabilities(
    session.user.id,
    session.user.email ?? undefined
  );

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold mb-4">My Businesses</h1>
      {caps.ownerOf.length === 0 ? (
        <p className="text-sm text-muted-foreground">No owned brands yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {caps.ownerOf.map((b) => (
            <Link key={b.id} href={`/brand/${b.slug}`} className="rounded-xl border p-4">
              {b.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
