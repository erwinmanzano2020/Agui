import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/auth/server";

type Row = {
  id: string;
  kind: string;
  status: string;
  applicant_entity_id: string;
  target_brand_id: string | null;
  decided_at: string | null;
  processed_at: string | null;
};

export default async function AdminApplicationsPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("entity_applications")
    .select("id, kind, status, applicant_entity_id, target_brand_id, decided_at, processed_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <div className="p-6 text-red-600">Failed to load applications: {error.message}</div>;
  }

  const apps = (data ?? []) as Row[];

  async function decide(id: string, action: "approve" | "reject") {
    "use server";
    const supabase = await createServerSupabase();
    await supabase.auth.getUser();

    const { cookies } = await import("next/headers");
    const res = await fetch(`/api/admin/applications/${id}/${action}`, {
      method: "POST",
      headers: { cookie: cookies().toString() },
    });

    let body: { warning?: string; error?: string } | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const message = body?.error ?? `Decision failed: ${res.status} ${res.statusText}`;
      throw new Error(message);
    }

    revalidatePath("/me/admin/applications");

    if (body?.warning) {
      throw new Error(body.warning);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Applications</h1>
      <div className="grid gap-3">
        {apps.map((a) => (
          <div key={a.id} className="rounded-xl border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium capitalize">{a.kind.split("_").join(" ")}</div>
              <div className="text-sm opacity-70">ID: {a.id}</div>
              <div className="text-sm opacity-70">Applicant: {a.applicant_entity_id}</div>
              {a.target_brand_id ? (
                <div className="text-sm opacity-70">Brand: {a.target_brand_id}</div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {a.processed_at ? (
                <span className="text-xs rounded-full bg-green-100 px-2 py-1 text-green-700">Processed</span>
              ) : a.status === "approved" ? (
                <span className="text-xs rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                  Approved (processing…)
                </span>
              ) : (
                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">{a.status}</span>
              )}
              {a.status === "pending" && (
                <>
                  <form action={decide.bind(null, a.id, "approve")}>
                    <button className="px-3 py-1 rounded-lg border hover:bg-gray-50">Approve</button>
                  </form>
                  <form action={decide.bind(null, a.id, "reject")}>
                    <button className="px-3 py-1 rounded-lg border hover:bg-gray-50">Reject</button>
                  </form>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
