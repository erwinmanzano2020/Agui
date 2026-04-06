export type EmployeeIdCardRow = {
  id: string;
  code: string;
  fullName: string | null;
  position: string | null;
  branchName: string | null;
  validUntil: string | null;
  houseId: string;
  houseName: string;
  houseBrandName: string | null;
  houseLogoUrl: string | null;
  photoUrl: string | null;
};

export type EmployeeIdPhotoStatus = "ready" | "missing" | "invalid_url";

export function normalizeEmployeePhotoUrl(photoUrl: string | null | undefined): string | null {
  const trimmed = photoUrl?.trim() ?? "";
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getEmployeeIdPhotoStatus(photoUrl: string | null | undefined): EmployeeIdPhotoStatus {
  const raw = photoUrl?.trim() ?? "";
  if (!raw) return "missing";
  return normalizeEmployeePhotoUrl(raw) ? "ready" : "invalid_url";
}

export function employeeIdCardSortKey(row: Pick<EmployeeIdCardRow, "code" | "id">): string {
  const code = row.code.trim().toLocaleLowerCase();
  return code.length > 0 ? code : row.id.toLocaleLowerCase();
}

export function orderEmployeeIdCards<T extends Pick<EmployeeIdCardRow, "code" | "id">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aKey = employeeIdCardSortKey(a);
    const bKey = employeeIdCardSortKey(b);
    if (aKey === bKey) {
      return a.id.localeCompare(b.id);
    }
    return aKey.localeCompare(bKey);
  });
}
