"use client";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  ot_grace_min: number;
  standard_minutes: number | null;
};

type ShiftForm = Omit<Shift, "id">;

export default function ShiftsPageClient() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [f, setF] = useState<ShiftForm>({
    code: "",
    name: "",
    start_time: "07:00",
    end_time: "17:30",
    ot_grace_min: 10,
    standard_minutes: 630,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Shift>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      return;
    }
    const { data, error } = await sb
      .from("shifts")
      .select(
        "id, code, name, start_time, end_time, ot_grace_min, standard_minutes",
      )
      .order("start_time");
    if (error) setErr(error.message);
    setRows(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }
    const { error } = await sb.from("shifts").insert(f);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setF({
      code: "",
      name: "",
      start_time: "07:00",
      end_time: "17:30",
      ot_grace_min: 10,
      standard_minutes: 630,
    });
    load();
  };

  const startEdit = (r: Shift) => {
    setEditingId(r.id);
    setEdit({ ...r });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEdit({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    setErr(null);
    const update = {
      code: edit.code,
      name: edit.name,
      start_time: edit.start_time,
      end_time: edit.end_time,
      ot_grace_min: Number(edit.ot_grace_min ?? 10),
      standard_minutes:
        edit.standard_minutes === null || edit.standard_minutes === undefined
          ? null
          : Number(edit.standard_minutes),
    };
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }
    const { error } = await sb
      .from("shifts")
      .update(update)
      .eq("id", editingId);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditingId(null);
    setEdit({});
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    setBusy(true);
    setErr(null);
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }
    const { error } = await sb.from("shifts").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Shift Templates</h1>
        <p className="text-sm text-[var(--agui-muted-foreground)]">
          Define reusable schedules and tweak them as your team evolves.
        </p>
      </header>

      <Card className="p-4">
        <form onSubmit={add} className="grid grid-cols-6 gap-3">
          <input
            className="col-span-2 rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-3 py-2 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
            placeholder="Code"
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value })}
            required
          />
          <input
            className="col-span-4 rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-3 py-2 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
            placeholder="Name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            required
          />
          <input
            className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-3 py-2 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
            type="time"
            value={f.start_time}
            onChange={(e) => setF({ ...f, start_time: e.target.value })}
            required
          />
          <input
            className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-3 py-2 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
            type="time"
            value={f.end_time}
            onChange={(e) => setF({ ...f, end_time: e.target.value })}
            required
          />
          <input
            className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-3 py-2 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
            type="number"
            min={0}
            value={f.ot_grace_min}
            onChange={(e) =>
              setF({ ...f, ot_grace_min: parseInt(e.target.value || "0", 10) })
            }
            required
          />
          <input
            className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-3 py-2 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
            type="number"
            min={0}
            value={f.standard_minutes ?? 0}
            onChange={(e) =>
              setF({
                ...f,
                standard_minutes: parseInt(e.target.value || "0", 10),
              })
            }
          />
          <Button type="submit" className="col-span-6" disabled={busy}>
            Add Shift
          </Button>
        </form>
      </Card>

      {err && (
        <div className="rounded-[var(--agui-radius)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          Error: {err}
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color-mix(in_srgb,_var(--agui-surface)_88%,_var(--agui-primary)_12%)] text-[color-mix(in_srgb,_var(--agui-on-surface)_90%,_var(--agui-surface)_10%)]">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Start</th>
              <th className="p-3 text-left">End</th>
              <th className="p-3 text-right">Grace (m)</th>
              <th className="p-3 text-right">Std mins</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-[color:color-mix(in_srgb,_var(--agui-card-border)_60%,_transparent)]"
              >
                <td className="p-3">
                  {editingId === r.id ? (
                    <input
                      className="w-full rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-2 py-1 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
                      value={edit.code as string}
                      onChange={(e) =>
                        setEdit({ ...edit, code: e.target.value })
                      }
                    />
                  ) : (
                    r.code
                  )}
                </td>
                <td className="p-3">
                  {editingId === r.id ? (
                    <input
                      className="w-full rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-2 py-1 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
                      value={edit.name as string}
                      onChange={(e) =>
                        setEdit({ ...edit, name: e.target.value })
                      }
                    />
                  ) : (
                    r.name
                  )}
                </td>
                <td className="p-3">
                  {editingId === r.id ? (
                    <input
                      className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-2 py-1 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
                      type="time"
                      value={edit.start_time as string}
                      onChange={(e) =>
                        setEdit({ ...edit, start_time: e.target.value })
                      }
                    />
                  ) : (
                    r.start_time
                  )}
                </td>
                <td className="p-3">
                  {editingId === r.id ? (
                    <input
                      className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-2 py-1 text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
                      type="time"
                      value={edit.end_time as string}
                      onChange={(e) =>
                        setEdit({ ...edit, end_time: e.target.value })
                      }
                    />
                  ) : (
                    r.end_time
                  )}
                </td>
                <td className="p-3 text-right">
                  {editingId === r.id ? (
                    <input
                      className="w-24 rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-2 py-1 text-right text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
                      type="number"
                      min={0}
                      value={(edit.ot_grace_min as number) ?? 10}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          ot_grace_min: parseInt(e.target.value || "0", 10),
                        })
                      }
                    />
                  ) : (
                    r.ot_grace_min
                  )}
                </td>
                <td className="p-3 text-right">
                  {editingId === r.id ? (
                    <input
                      className="w-24 rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-surface-border)_70%,_transparent)] bg-transparent px-2 py-1 text-right text-sm focus-visible:border-[var(--agui-accent)] focus-visible:outline-none"
                      type="number"
                      min={0}
                      value={(edit.standard_minutes as number) ?? 0}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          standard_minutes: parseInt(e.target.value || "0", 10),
                        })
                      }
                    />
                  ) : (
                    (r.standard_minutes ?? "")
                  )}
                </td>
                <td className="p-3 text-center">
                  {editingId === r.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="text-xs"
                        onClick={saveEdit}
                        disabled={busy}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="text-xs"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="text-xs"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="text-xs text-danger/70 hover:text-danger"
                        onClick={() => remove(r.id)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-center text-sm text-[var(--agui-muted-foreground)]" colSpan={7}>
                  No shifts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
