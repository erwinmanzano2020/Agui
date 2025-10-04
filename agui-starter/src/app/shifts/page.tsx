"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  ot_grace_min: number;
  standard_minutes: number | null;
};

export default function ShiftsPage() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [f, setF] = useState({
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
    const { data, error } = await supabase
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
    const { error } = await supabase.from("shifts").insert(f as any);
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
    const { error } = await supabase
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
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Shift Templates</h1>

      <form onSubmit={add} className="mb-6 grid grid-cols-6 gap-2">
        <input
          className="border rounded px-3 py-2 col-span-2"
          placeholder="Code"
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value })}
          required
        />
        <input
          className="border rounded px-3 py-2 col-span-4"
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
        />
        <input
          className="border rounded px-3 py-2"
          type="time"
          value={f.start_time}
          onChange={(e) => setF({ ...f, start_time: e.target.value })}
          required
        />
        <input
          className="border rounded px-3 py-2"
          type="time"
          value={f.end_time}
          onChange={(e) => setF({ ...f, end_time: e.target.value })}
          required
        />
        <input
          className="border rounded px-3 py-2"
          type="number"
          min={0}
          value={f.ot_grace_min}
          onChange={(e) =>
            setF({ ...f, ot_grace_min: parseInt(e.target.value || "0", 10) })
          }
          required
        />
        <input
          className="border rounded px-3 py-2"
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
        <button
          className="col-span-6 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={busy}
        >
          Add Shift
        </button>
      </form>

      {err && <div className="text-sm text-red-600 mb-3">Error: {err}</div>}

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Start</th>
              <th className="p-2 text-left">End</th>
              <th className="p-2 text-right">Grace (m)</th>
              <th className="p-2 text-right">Std mins</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={edit.code as string}
                      onChange={(e) =>
                        setEdit({ ...edit, code: e.target.value })
                      }
                    />
                  ) : (
                    r.code
                  )}
                </td>
                <td className="p-2">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={edit.name as string}
                      onChange={(e) =>
                        setEdit({ ...edit, name: e.target.value })
                      }
                    />
                  ) : (
                    r.name
                  )}
                </td>
                <td className="p-2">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1"
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
                <td className="p-2">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1"
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
                <td className="p-2 text-right">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1 w-24 text-right"
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
                <td className="p-2 text-right">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1 w-24 text-right"
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
                <td className="p-2 text-center">
                  {editingId === r.id ? (
                    <>
                      <button
                        className="text-xs underline mr-2"
                        onClick={saveEdit}
                        disabled={busy}
                      >
                        Save
                      </button>
                      <button
                        className="text-xs underline"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="text-xs underline mr-2"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs underline text-red-700"
                        onClick={() => remove(r.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-2" colSpan={7}>
                  No shifts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
