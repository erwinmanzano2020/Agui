import { createServerSupabase } from "@/lib/auth/server";
import Link from "next/link";
import { revalidatePath } from "next/cache";

function hasObjectMeta(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

type ApplicationRow = {
  id: string;
  created_at: string | null;
  kind: string;
  status: string;
  target_brand_id: string | null;
  applicant_entity_id: string | null;
  meta: unknown;
  identifier_kind: string | null;
  raw_value: string | null;
};

export default async function ApplicationsAdminPage() {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("entity_applications")
    .select(
      "id, created_at, kind, status, target_brand_id, applicant_entity_id, meta, identifier_kind, raw_value"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6">Failed to load: {error.message}</div>;
  }

  const applications = (data ?? []) as ApplicationRow[];

  async function decide(id: string, action: "approve" | "reject") {
    "use server";
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { error } = await supabase
      .from("entity_applications" as never)
      .update({
        status: action === "approve" ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", id as never);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/me/admin/applications");
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Applications</h1>
      <p className="opacity-70">Review new enroll/apply requests.</p>

      <div className="grid gap-3">
        {applications.map((a) => (
          <div key={a.id} className="rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-70">{new Date(a.created_at!).toLocaleString()}</div>
              <div className="text-xs uppercase tracking-wide">{a.kind} · {a.status}</div>
            </div>

            <div className="mt-2 text-sm opacity-80">
              Brand: <code>{a.target_brand_id ?? "—"}</code> · Applicant: <code>{a.applicant_entity_id}</code>
            </div>
            {a.identifier_kind && a.raw_value && (
              <div className="mt-1 text-sm">ID: {a.identifier_kind} — <code>{a.raw_value}</code></div>
            )}
            {hasObjectMeta(a.meta) && Object.keys(a.meta).length > 0 && (
              <pre className="mt-2 text-xs bg-black/5 p-2 rounded">{JSON.stringify(a.meta, null, 2)}</pre>
            )}

            <div className="mt-3 flex gap-2">
              <form action={async () => decide(a.id, "approve")}>
                <button className="px-3 py-1 rounded-lg border">Approve</button>
              </form>
              <form action={async () => decide(a.id, "reject")}>
                <button className="px-3 py-1 rounded-lg border">Reject</button>
              </form>
              <Link href={`/me`} className="ml-auto text-sm underline">
                Back to Me
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
