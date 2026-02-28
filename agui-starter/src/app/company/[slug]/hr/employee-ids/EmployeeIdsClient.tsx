"use client";

import * as React from "react";

import type { BranchListItem } from "@/lib/hr/employees-server";
import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";

type Props = {
  houseId: string;
  basePath: string;
  employees: EmployeeIdCardRow[];
  branches: BranchListItem[];
  initialBranchId: string;
  initialSearch: string;
};

export function EmployeeIdsClient({
  houseId,
  basePath,
  employees,
  branches,
  initialBranchId,
  initialSearch,
}: Props) {
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectedIds = React.useMemo(
    () => employees.filter((employee) => selected[employee.id]).map((employee) => employee.id),
    [employees, selected],
  );

  const printSelected = async () => {
    if (selectedIds.length === 0) return;
    const response = await fetch("/api/hr/employee-ids/print", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ houseId, employeeIds: selectedIds, layout: "a4_8up", includeCutGuides: true }),
    });

    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Employee IDs</h2>
      <form className="grid gap-2 md:grid-cols-3" method="get" action={basePath}>
        <select name="branch" defaultValue={initialBranchId} className="rounded border px-2 py-1">
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={initialSearch}
          placeholder="Search employee code"
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">Apply filters</button>
      </form>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1"
          onClick={printSelected}
          disabled={selectedIds.length === 0}
        >
          Print Selected (A4)
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Select</th>
            <th>Name</th>
            <th>Code</th>
            <th>Position</th>
            <th>Branch</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b">
              <td>
                <input type="checkbox" checked={Boolean(selected[employee.id])} onChange={() => toggle(employee.id)} />
              </td>
              <td>{employee.fullName ?? employee.code}</td>
              <td>{employee.code}</td>
              <td>{employee.position ?? "—"}</td>
              <td>{employee.branchName ?? "—"}</td>
              <td className="space-x-2 py-2">
                <a
                  href={`/api/hr/employees/${employee.id}/id-card.pdf?houseId=${houseId}&format=cr80`}
                  className="rounded border px-2 py-1"
                >
                  Preview ID
                </a>
                <a
                  href={`/api/hr/employees/${employee.id}/id-card.pdf?houseId=${houseId}&format=cr80`}
                  className="rounded border px-2 py-1"
                >
                  Download Single (PDF)
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
