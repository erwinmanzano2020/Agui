import assert from "node:assert/strict";
import { test } from "node:test";

import { generatePayrollRunPdf } from "../payroll-run-pdf";
import { generatePayslipPdf, type PayslipPdfInput } from "../payslip-pdf";

const basePayslip: PayslipPdfInput = {
  employeeName: "Edward Rivera",
  employeeCode: "EI-004",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  runReferenceCode: "PR-2026-001",
  runStatus: "finalized",
  finalizedAt: "2026-02-10T07:24:00+08:00",
  regularPay: 1000,
  overtimePay: 150,
  undertimeDeduction: 23.81,
  deductions: [],
  deductionsTotal: 23.81,
  grossPay: 1150,
  netPay: 1126.19,
  format: "a4",
};

test("payslip PDF keeps long deduction labels and repeats table header on multi-page deductions", () => {
  const deductions = Array.from({ length: 90 }, (_, index) => ({
    label:
      index === 45
        ? "Cash advance installment for grocery and household essentials deduction"
        : `Deduction label ${index + 1}`,
    amount: (index + 1) * 3,
  }));

  const deductionsTotal = deductions.reduce((sum, row) => sum + row.amount, basePayslip.undertimeDeduction);
  const pdf = generatePayslipPdf({
    ...basePayslip,
    deductions,
    deductionsTotal,
    netPay: basePayslip.grossPay - deductionsTotal,
  });

  const text = new TextDecoder().decode(pdf);
  assert.ok(text.includes("Cash advance installment for grocery and household essentials deduction"));

  const descriptionHeaders = text.match(/Description/g) ?? [];
  assert.ok(descriptionHeaders.length >= 2, "expected repeated table headers across pages");
});

test("register PDF repeats employee table header on new pages", () => {
  const payslips = Array.from({ length: 110 }, (_, index) => ({
    ...basePayslip,
    employeeName: `Employee ${String(index + 1).padStart(3, "0")}`,
    employeeCode: `EMP-${String(index + 1).padStart(3, "0")}`,
    regularPay: 1000 + index,
    overtimePay: index,
    grossPay: 1000 + index * 2,
    netPay: 900 + index * 2,
  }));

  const pdf = generatePayrollRunPdf({
    houseName: "Casa Payroll",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    runStatus: "posted",
    runReferenceCode: "PR-2026-001",
    summary: {
      totalEmployees: payslips.length,
      totalRegularPay: payslips.reduce((sum, row) => sum + row.regularPay, 0),
      totalOvertimePay: payslips.reduce((sum, row) => sum + row.overtimePay, 0),
      totalUndertimeDeductions: 0,
      totalManualDeductions: 0,
      totalGrossPay: payslips.reduce((sum, row) => sum + row.grossPay, 0),
      totalNetPay: payslips.reduce((sum, row) => sum + row.netPay, 0),
      missingScheduleDays: 0,
      correctedSegments: 0,
      openSegments: 0,
    },
    payslips,
    includePayslipPages: false,
  });

  const text = new TextDecoder().decode(pdf);
  const employeeHeaderCount = text.match(/Employee \/ Code/g) ?? [];
  assert.ok(employeeHeaderCount.length >= 2, "expected employee table header to repeat");
});
