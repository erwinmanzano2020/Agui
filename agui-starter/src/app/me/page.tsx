// src/app/me/page.tsx
import { getServerSession } from "@/lib/auth/server";
import { getCapabilities } from "@/lib/roles/capabilities";
import { AppGrid } from "@/components/apps/app-grid";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getServerSession();
  if (!session) {
    // In case middleware didn’t catch it.
    // Keep the UX consistent: bounce to welcome.
    return null;
  }

  const caps = await getCapabilities(
    session.user.id,
    session.user.email ?? undefined
  );

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Your hub</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Quick access to your apps. What you see depends on your role(s).
        </p>
      </header>

      <AppGrid caps={caps} />
    </main>
  );
}
