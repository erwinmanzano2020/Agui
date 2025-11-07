import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MePage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect(`/welcome?next=${encodeURIComponent("/me")}`);
  }

  const user = data.user;

  return (
    <main className="mx-auto max-w-screen-sm space-y-6 p-4">
      <section>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-neutral-500">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
      </section>

      <section className="grid gap-3">
        <Link
          href="/my/apps"
          className="block rounded-xl border p-4 hover:bg-neutral-50"
        >
          <div className="font-medium">My Apps</div>
          <div className="text-sm text-neutral-500">
            Open your available tiles, or discover apps you can request.
          </div>
        </Link>
        <Link
          href="/company"
          className="block rounded-xl border p-4 hover:bg-neutral-50"
        >
          <div className="font-medium">My Businesses</div>
          <div className="text-sm text-neutral-500">
            Manage stores, roles, and staff.
          </div>
        </Link>
      </section>
    </main>
  );
}
