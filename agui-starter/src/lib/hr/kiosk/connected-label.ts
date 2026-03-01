export type KioskConnectedDevice = {
  id: string;
  name: string;
  branch_id: string;
  branch_name?: string | null;
};

export function resolveConnectedLabel(device: KioskConnectedDevice | null): string | null {
  if (!device) return null;
  const branchLabel = device.branch_name?.trim() || device.branch_id?.trim() || "Unknown branch";
  const deviceLabel = device.name?.trim() || "Unnamed device";
  return `Connected to: ${branchLabel} • ${deviceLabel}`;
}
