import { createServerSupabase } from "@/lib/auth/server";
import type { AppInboxRow, AppInboxUpdate } from "@/lib/db.types";

export type InboxItem = Pick<
  AppInboxRow,
  "id" | "kind" | "title" | "body" | "ref" | "created_at" | "read_at"
>;
export type InboxList = { unread: InboxItem[]; read: InboxItem[]; unreadCount: number };

export async function fetchInbox(): Promise<InboxList> {
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

  const unreadItems: InboxItem[] = (unread ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    body: item.body,
    ref: item.ref,
    created_at: item.created_at,
    read_at: item.read_at,
  }));

  const readItems: InboxItem[] = (read ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    body: item.body,
    ref: item.ref,
    created_at: item.created_at,
    read_at: item.read_at,
  }));

  return {
    unread: unreadItems,
    read: readItems,
    unreadCount: unreadItems.length,
  };
}

export async function markRead(id: string) {
  const supabase = await createServerSupabase();
  const patch: AppInboxUpdate = { read_at: new Date().toISOString() };

  const { error } = await supabase.from("app_inbox").update(patch).eq("id", id);

  if (error) throw new Error(`Mark read failed: ${error.message}`);
}

export async function markAllRead() {
  const supabase = await createServerSupabase();
  const patch: AppInboxUpdate = { read_at: new Date().toISOString() };

  // RLS limits scope to current entity
  const { error } = await supabase.from("app_inbox").update(patch).is("read_at", null);

  if (error) throw new Error(`Mark all read failed: ${error.message}`);
}
