"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";

type Row = {
  id: string;
  period: string;
  employees: number;
  gross: number;
  deductions: number;
  net: number;
};

export default function PayrollPageClient() {
  // Demo data — you’ll wire real data later
  const [rows] = useState<Row[]>([
    {
      id: "PR-0001",
      period: "2025-09-16 → 2025-09-30",
      employees: 8,
      gross: 42345,
      deductions: 5345,
      net: 37000,
    },
    {
      id: "PR-0002",
      period: "2025-10-01 → 2025-10-15",
      employees: 9,
      gross: 48120,
      deductions: 6120,
      net: 42000,
    },
  ]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const columns = useMemo<Column<Row>[]>(
    () => [
      { key: "id", header: "Run ID", width: "140px" },
      { key: "period", header: "Period" },
      { key: "employees", header: "Employees", width: "120px", align: "right" },
      {
        key: "gross",
        header: "Gross",
        width: "140px",
        align: "right",
        render: (r) => peso(r.gross),
      },
      {
        key: "deductions",
        header: "Deductions",
        width: "140px",
        align: "right",
        render: (r) => peso(r.deductions),
      },
      {
        key: "net",
        header: "Net",
        width: "140px",
        align: "right",
        render: (r) => <strong>{peso(r.net)}</strong>,
      },
    ],
    [],
  );

  return (
    <PageHeader
      title="Payroll"
      subtitle="Manage employee pay and records"
      actions={
        <>
          <Button type="button">Add Payroll</Button>
          <Button type="button" variant="ghost">
            Export
          </Button>
        </>
      }
    >
      <DataTable<Row>
        columns={columns}
        rows={rows}
        state={{
          page,
          pageSize,
          total: rows.length,
          density: "comfortable",
          loading: false,
          error: null,
        }}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        getRowId={(r) => r.id}
        emptyMessage="No payroll runs yet."
      />
    </PageHeader>
  );
}

function peso(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}
