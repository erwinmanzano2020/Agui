import { fetchInbox } from "@/lib/inbox/queries.server";
import { revalidatePath } from "next/cache";

async function mark(id: string) {
  "use server";
  const { markRead } = await import("@/lib/inbox/queries.server");
  await markRead(id);
  revalidatePath("/me/inbox");
}

async function markAll() {
  "use server";
  const { markAllRead } = await import("@/lib/inbox/queries.server");
  await markAllRead();
  revalidatePath("/me/inbox");
}

export default async function InboxPage() {
  const { unread, read } = await fetchInbox();

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <form action={markAll}>
          <button className="border px-3 py-1.5 rounded">Mark all read</button>
        </form>
      </div>

      {unread.length === 0 && read.length === 0 ? (
        <p className="opacity-70">You’re all caught up.</p>
      ) : (
        <>
          {unread.length > 0 && (
            <section>
              <h2 className="font-medium mb-2">Unread</h2>
              <ul className="space-y-2">
                {unread.map((m) => (
                  <li key={m.id} className="border rounded p-3 bg-amber-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        {m.body && <div className="text-sm opacity-80">{m.body}</div>}
                        <div className="text-xs opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                      <form action={mark.bind(null, m.id)}>
                        <button className="text-sm underline">Mark read</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {read.length > 0 && (
            <section>
              <h2 className="font-medium mb-2 mt-6">Read</h2>
              <ul className="space-y-2">
                {read.map((m) => (
                  <li key={m.id} className="border rounded p-3">
                    <div className="font-medium">{m.title}</div>
                    {m.body && <div className="text-sm opacity-80">{m.body}</div>}
                    <div className="text-xs opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
