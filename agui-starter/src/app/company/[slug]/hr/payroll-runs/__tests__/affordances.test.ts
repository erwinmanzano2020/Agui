import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import type { ReactNode } from "react";

import * as requireAuthModule from "@/lib/auth/require-auth";
import * as hrAccess from "@/lib/hr/access";
import * as payrollServer from "@/lib/hr/payroll-runs-server";
import HrPayslipsPage from "../../payslips/page";
import PayrollRunDetailPage from "../[runId]/page";
import PayrollRunsPage from "../page";

function visit(node: ReactNode, callback: (node: { type?: unknown; props: Record<string, unknown> }) => void) {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) return node.forEach((child) => visit(child, callback));
  if (typeof node !== "object" || !("props" in node)) return;
  const element = node as { type?: unknown; props: Record<string, unknown> };
  callback(element);
  visit(element.props.children as ReactNode, callback);
}

function renderedComponentNames(node: ReactNode) {
  const names: string[] = [];
  visit(node, (element) => {
    if (typeof element.type === "function") names.push(element.type.name);
  });
  return names;
}

function renderedText(node: ReactNode) {
  const text: string[] = [];
  const collect = (value: ReactNode) => {
    if (typeof value === "string") text.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object" && "props" in value) {
      collect((value as { props: { children?: ReactNode } }).props.children);
    }
  };
  collect(node);
  return text.join(" ");
}

const readAccess = {
  allowed: true,
  allowedByRole: false,
  allowedByPolicy: true,
  isBranchLimited: true,
  allowedBranchIds: ["branch-a"],
  policyKeys: ["tiles.payroll.read", "hr.branch.branch-a"],
};

const broadWriteAccess = {
  allowed: true,
  allowedByRole: true,
  allowedByPolicy: false,
  isBranchLimited: false,
  allowedBranchIds: [],
  policyKeys: [],
};

function setupAccess(writeAccess: Record<string, unknown>) {
  const house = { id: "house-1", slug: "demo", name: "Demo" };
  mock.method(requireAuthModule, "requireAuth", async () => ({
    supabase: {
      from: () => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: house, error: null }),
      }),
    } as never,
  }));
  let accessCalls = 0;
  mock.method(hrAccess, "requireHrAccessWithBranch", async () => (
    accessCalls++ === 0 ? readAccess : writeAccess
  ) as never);
}

function payrollRun(status: "draft" | "finalized" | "posted" | "paid") {
  return {
    id: "run-1",
    houseId: "house-1",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-15",
    status,
    referenceCode: null,
    finalizedAt: null,
    finalizedBy: null,
    finalizeNote: null,
    postedAt: null,
    postedBy: null,
    postNote: null,
    paidAt: null,
    paidBy: null,
    paymentMethod: null,
    paymentNote: null,
    createdAt: "2026-08-16T00:00:00Z",
  };
}

describe("payroll mutation affordances", () => {
  afterEach(() => mock.restoreAll());

  it("keeps payroll runs readable but hides creation from read-only actors", async () => {
    setupAccess({ ...readAccess, allowed: false });
    mock.method(payrollServer, "listPayrollRunsForHouse", async () => [{ ...payrollRun("draft"), itemCount: 1 }]);

    const page = await PayrollRunsPage({ params: Promise.resolve({ slug: "demo" }) });

    assert.match(renderedText(page), /2026-08-01/);
    assert.match(renderedText(page), /read-only access to payroll runs/);
    assert.ok(!renderedComponentNames(page).includes("PayrollRunCreateForm"));
  });

  it("shows payroll-run creation to broad requested-house authority", async () => {
    setupAccess(broadWriteAccess);
    mock.method(payrollServer, "listPayrollRunsForHouse", async () => []);

    const page = await PayrollRunsPage({ params: Promise.resolve({ slug: "demo" }) });

    assert.ok(renderedComponentNames(page).includes("PayrollRunCreateForm"));
  });

  it("does not treat a branch-limited payroll capability as house-global UI authority", async () => {
    setupAccess({ ...readAccess, allowed: true, evaluatedLevel: "write", evaluatedCapability: "payroll" });
    mock.method(payrollServer, "listPayrollRunsForHouse", async () => []);

    const page = await PayrollRunsPage({ params: Promise.resolve({ slug: "demo" }) });

    assert.ok(!renderedComponentNames(page).includes("PayrollRunCreateForm"));
    assert.match(renderedText(page), /read-only access to payroll runs/);
  });

  it("hides status transitions, adjustments, and deduction mutation from a reader", async () => {
    setupAccess({ ...readAccess, allowed: false });
    mock.method(payrollServer, "getPayrollRunWithItems", async () => ({
      run: payrollRun("posted"),
      items: [{
        id: "item-1", employeeId: "employee-1", employeeName: "Allowed Employee", employeeCode: "E-1",
        workMinutes: 480, overtimeMinutesRaw: 0, overtimeMinutesRounded: 0,
        missingScheduleDays: 0, openSegmentDays: 0, correctedSegmentDays: 0,
      }],
    }) as never);

    const page = await PayrollRunDetailPage({ params: Promise.resolve({ slug: "demo", runId: "run-1" }) });
    const names = renderedComponentNames(page);
    let panelCanMutate: unknown;
    visit(page, (element) => {
      if (typeof element.type === "function" && element.type.name === "PayslipPreviewPanel") {
        panelCanMutate = element.props.canMutatePayroll;
      }
    });

    assert.match(renderedText(page), /Allowed Employee/);
    assert.ok(!names.includes("MarkPayrollRunPaidForm"));
    assert.ok(!names.includes("CreateAdjustmentRunButton"));
    assert.equal(panelCanMutate, false);
  });

  it("preserves lifecycle mutation controls for broad authority", async () => {
    setupAccess(broadWriteAccess);
    mock.method(payrollServer, "getPayrollRunWithItems", async () => ({
      run: payrollRun("posted"),
      items: [{
        id: "item-1", employeeId: "employee-1", employeeName: "Employee", employeeCode: "E-1",
        workMinutes: 480, overtimeMinutesRaw: 0, overtimeMinutesRounded: 0,
        missingScheduleDays: 0, openSegmentDays: 0, correctedSegmentDays: 0,
      }],
    }) as never);

    const page = await PayrollRunDetailPage({ params: Promise.resolve({ slug: "demo", runId: "run-1" }) });
    const names = renderedComponentNames(page);

    assert.ok(names.includes("MarkPayrollRunPaidForm"));
    assert.ok(names.includes("CreateAdjustmentRunButton"));
  });

  it("passes denied payroll mutation authority to the standalone payslip panel", async () => {
    setupAccess({ ...readAccess, allowed: false });
    mock.method(payrollServer, "listPayrollRunsForHouse", async () => [{ ...payrollRun("draft"), itemCount: 1 }]);
    mock.method(payrollServer, "getPayrollRunWithItems", async () => ({
      run: payrollRun("draft"),
      items: [{ id: "item-1", employeeId: "employee-1", employeeName: "Employee", employeeCode: "E-1" }],
    }) as never);

    const page = await HrPayslipsPage({ params: Promise.resolve({ slug: "demo" }) });
    let panelCanMutate: unknown;
    visit(page, (element) => {
      if (typeof element.type === "function" && element.type.name === "PayslipPreviewPanel") {
        panelCanMutate = element.props.canMutatePayroll;
      }
    });

    assert.equal(panelCanMutate, false);
    assert.match(renderedText(page), /Payslips/);
  });
});
