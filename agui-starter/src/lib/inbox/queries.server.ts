import { createServerSupabase } from "@/lib/auth/server";

export async function fetchInbox(): Promise<import("./types").InboxList> {
  const supabase = await createServerSupabase();

  const { data: unread, error: e1 } = await supabase
    .from("app_inbox")
    .select("id, kind, title, body, ref, created_at, read_at")
    .is("read_at", null)
    .order("created_at", { ascending: false });

  if (e1) throw new Error(`Load unread failed: ${e1.message}`);

  const { data: read, error: e2 } = await supabase
    .from("app_inbox")
    .select("id, kind, title, body, ref, created_at, read_at")
    .not("read_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (e2) throw new Error(`Load read failed: ${e2.message}`);

  return {
    unread: unread ?? [],
    read: read ?? [],
    unreadCount: (unread ?? []).length,
  };
}

export async function markRead(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("app_inbox")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Mark read failed: ${error.message}`);
}

export async function markAllRead() {
  const supabase = await createServerSupabase();
  // Only updates rows visible to current entity via RLS
  const { error } = await supabase
    .from("app_inbox")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(`Mark all read failed: ${error.message}`);
}
