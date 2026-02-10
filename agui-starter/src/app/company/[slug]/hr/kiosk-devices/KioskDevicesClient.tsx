"use client";

import * as React from "react";

import type { BranchListItem } from "@/lib/hr/employees-server";
import type { KioskDeviceAdminRow, KioskDeviceEventRow } from "@/lib/hr/kiosk/admin";

type Props = {
  houseId: string;
  houseSlug: string;
  branches: BranchListItem[];
  initialDevices: KioskDeviceAdminRow[];
};

function formatManila(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function metadataSummary(metadata: Record<string, unknown>): string {
  const safeKeys = ["reason", "clientId", "clientEventId", "action"];
  const pairs = safeKeys
    .map((key) => {
      const value = metadata[key];
      return value == null ? null : `${key}: ${String(value)}`;
    })
    .filter(Boolean);
  return pairs.join(" • ") || "—";
}

export function KioskDevicesClient({ houseId, branches, initialDevices }: Props) {
  const [devices, setDevices] = React.useState(initialDevices);
  const [selectedBranch, setSelectedBranch] = React.useState("");
  const [name, setName] = React.useState("");
  const [token, setToken] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<KioskDeviceEventRow[]>([]);
  const [selectedDevice, setSelectedDevice] = React.useState<KioskDeviceAdminRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (branchId?: string) => {
    const url = new URL("/api/hr/kiosk-devices", window.location.origin);
    url.searchParams.set("houseId", houseId);
    if (branchId) url.searchParams.set("branchId", branchId);
    const response = await fetch(url.toString());
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Failed to load devices.");
    setDevices(payload.devices ?? []);
  }, [houseId]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setToken(null);
    try {
      const response = await fetch("/api/hr/kiosk-devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId, branchId: selectedBranch, name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Failed to create device.");
      setToken(payload.token ?? null);
      setName("");
      await refresh(selectedBranch || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create device.");
    }
  };

  const toggleDevice = async (deviceId: string, enabled: boolean) => {
    const endpoint = enabled ? "enable" : "disable";
    const response = await fetch(`/api/hr/kiosk-devices/${deviceId}/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ houseId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? `Failed to ${endpoint} device.`);
    await refresh(selectedBranch || undefined);
  };

  const rotateToken = async (deviceId: string) => {
    const response = await fetch(`/api/hr/kiosk-devices/${deviceId}/rotate-token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ houseId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Failed to rotate token.");
    setToken(payload.token ?? null);
    await refresh(selectedBranch || undefined);
  };

  const loadEvents = async (device: KioskDeviceAdminRow) => {
    const url = new URL(`/api/hr/kiosk-devices/${device.id}/events`, window.location.origin);
    url.searchParams.set("houseId", houseId);
    url.searchParams.set("limit", "50");
    const response = await fetch(url.toString());
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Failed to load events.");
    setSelectedDevice(device);
    setEvents(payload.events ?? []);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Create Device</h2>
        <form onSubmit={handleCreate} className="mt-3 grid gap-3 md:grid-cols-3">
          <select className="rounded border px-2 py-1" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} required>
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <input className="rounded border px-2 py-1" placeholder="Frontdesk Android #1" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="rounded bg-primary px-3 py-1 text-white" type="submit">Create device</button>
        </form>
        {token ? (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium">Save this token now. You won’t be able to view it again.</p>
            <code className="mt-2 block break-all rounded bg-white p-2">{token}</code>
            <button className="mt-2 rounded border px-2 py-1" onClick={() => navigator.clipboard.writeText(token)}>Copy token</button>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Devices</h2>
          <select className="rounded border px-2 py-1" value={selectedBranch} onChange={async (e) => {
            const value = e.target.value;
            setSelectedBranch(value);
            await refresh(value || undefined);
          }}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th>Name</th><th>Branch</th><th>Status</th><th>Created at</th><th>Last seen at</th><th>Last event at</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-b align-top">
                <td>{device.name}</td>
                <td>{device.branches?.[0]?.name ?? device.branch_id}</td>
                <td>{device.is_active ? "enabled" : "disabled"}</td>
                <td>{formatManila(device.created_at)}</td>
                <td>{formatManila(device.last_seen_at)}</td>
                <td>{formatManila(device.last_event_at)}</td>
                <td className="space-x-2 py-2">
                  <button className="rounded border px-2 py-1" onClick={() => toggleDevice(device.id, !device.is_active)}>
                    {device.is_active ? "Disable" : "Enable"}
                  </button>
                  <button className="rounded border px-2 py-1" onClick={() => rotateToken(device.id)}>Rotate Token</button>
                  <button className="rounded border px-2 py-1" onClick={() => loadEvents(device)}>View Events</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedDevice ? (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="text-lg font-semibold">{selectedDevice.name} events</h3>
          <div className="mt-3 space-y-2 text-sm">
            {events.map((event) => (
              <div key={event.id} className="rounded border p-2">
                <p>{formatManila(event.occurred_at)} • {event.event_type}</p>
                <p>employee_id: {event.employee_id ?? "—"}</p>
                <p>segment_id: {typeof event.metadata.segmentId === "string" ? event.metadata.segmentId : "—"}</p>
                <p>{metadataSummary(event.metadata)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
