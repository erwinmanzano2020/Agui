"use client";

import * as React from "react";
import Image from "next/image";
import QRCode from "qrcode";

import type { BranchListItem } from "@/lib/hr/employees-server";
import type { KioskDeviceAdminRow, KioskDeviceEventRow } from "@/lib/hr/kiosk/admin";
import {
  buildKioskSetupWizardUrl,
  buildProvisioningTokenPayload,
} from "@/lib/hr/kiosk/provisioning-handoff";

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

export function KioskDevicesClient({ houseId, houseSlug, branches, initialDevices }: Props) {
  const [devices, setDevices] = React.useState(initialDevices);
  const [selectedBranch, setSelectedBranch] = React.useState("");
  const [name, setName] = React.useState("");
  const [token, setToken] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<KioskDeviceEventRow[]>([]);
  const [selectedDevice, setSelectedDevice] = React.useState<KioskDeviceAdminRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [setupUrl, setSetupUrl] = React.useState<string>("");
  const [setupQrDataUrl, setSetupQrDataUrl] = React.useState<string | null>(null);
  const [tokenQrDataUrl, setTokenQrDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const nextSetupUrl = buildKioskSetupWizardUrl({ origin: window.location.origin, houseSlug });
    setSetupUrl(nextSetupUrl);

    void QRCode.toDataURL(nextSetupUrl, {
      type: "image/png",
      errorCorrectionLevel: "M",
      margin: 0,
      width: 256,
    })
      .then((dataUrl) => setSetupQrDataUrl(dataUrl))
      .catch(() => setSetupQrDataUrl(null));
  }, [houseSlug]);

  React.useEffect(() => {
    if (!token) {
      setTokenQrDataUrl(null);
      return;
    }

    const tokenPayload = buildProvisioningTokenPayload(token);
    void QRCode.toDataURL(tokenPayload, {
      type: "image/png",
      errorCorrectionLevel: "M",
      margin: 0,
      width: 256,
    })
      .then((dataUrl) => setTokenQrDataUrl(dataUrl))
      .catch(() => setTokenQrDataUrl(null));
  }, [token]);

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
        <h2 className="text-lg font-semibold">Kiosk Setup Wizard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep admin login on your own device. Create or rotate token here, then hand off setup to the kiosk tablet using the setup QR and provisioning token QR.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Create or rotate device token on this page.</li>
          <li>Scan Setup QR on the kiosk tablet to open setup mode without admin login.</li>
          <li>Scan Provisioning Token QR into token input, or paste manually, then verify and finish setup.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={setupUrl || `/company/${houseSlug}/kiosk?setup=1`}
            className="inline-flex rounded border px-3 py-1.5 text-sm"
            target="_blank"
            rel="noreferrer"
          >
            Open Kiosk Setup Wizard
          </a>
          {setupUrl ? (
            <button className="inline-flex rounded border px-3 py-1.5 text-sm" onClick={() => navigator.clipboard.writeText(setupUrl)}>
              Copy setup URL
            </button>
          ) : null}
        </div>
        {setupQrDataUrl ? (
          <div className="mt-3 rounded border bg-slate-50 p-3 text-sm">
            <p className="font-medium">Setup QR (open wizard on kiosk device)</p>
            <Image
              alt="Kiosk setup wizard QR code"
              className="mt-2 rounded border bg-white p-2"
              src={setupQrDataUrl}
              width={160}
              height={160}
              unoptimized
            />
            <p className="mt-2 break-all text-xs text-muted-foreground">{setupUrl}</p>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Setup URL and provisioning token are separated by design. Do not log in as admin on the kiosk tablet.
        </p>
      </section>

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
            {tokenQrDataUrl ? (
              <div className="mt-3">
                <p className="font-medium">Provisioning Token QR (scan into kiosk token field)</p>
                <Image
                  alt="Kiosk provisioning token QR code"
                  className="mt-2 rounded border bg-white p-2"
                  src={tokenQrDataUrl}
                  width={160}
                  height={160}
                  unoptimized
                />
              </div>
            ) : null}
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
                <td>{device.branch?.name ?? device.branch_id}</td>
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
