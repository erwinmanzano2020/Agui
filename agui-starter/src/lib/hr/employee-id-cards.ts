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
};

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
