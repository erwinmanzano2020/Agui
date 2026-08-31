import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import type { ReactNode } from "react";

import * as requireAuthModule from "@/lib/auth/require-auth";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as overtimeServer from "@/lib/hr/overtime-policy-server";
import * as schedulesServer from "@/lib/hr/schedules-server";
import {
  addScheduleWindowAction,
  createBranchScheduleAssignmentAction,
  createScheduleTemplateAction,
  updateOvertimePolicyAction,
} from "../actions";
import HrSchedulesPage from "../page";

function visit(node: ReactNode, callback: (props: Record<string, unknown>) => void) {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) return node.forEach((child) => visit(child, callback));
  if (typeof node !== "object" || !("props" in node)) return;
  const props = (node as { props: Record<string, unknown> }).props;
  callback(props);
  visit(props.children as ReactNode, callback);
}

function renderedActions(node: ReactNode) {
  const actions: unknown[] = [];
  visit(node, (props) => { if (props.action) actions.push(props.action); });
  return actions;
}

function renderedText(node: ReactNode) {
  const text: string[] = [];
  const collect = (value: ReactNode) => {
    if (typeof value === "string") text.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object" && "props" in value) collect((value as { props: { children?: ReactNode } }).props.children);
  };
  collect(node);
  return text.join(" ");
}

function setup(readAccess: Record<string, unknown>, writeAccess: Record<string, unknown>) {
  const house = { id: "house-1", slug: "demo", name: "Demo" };
  mock.method(requireAuthModule, "requireAuth", async () => ({
    supabase: { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: house, error: null }) }) } as never,
  }));
  let calls = 0;
  mock.method(hrAccess, "requireHrAccessWithBranch", async () => (calls++ === 0 ? readAccess : writeAccess) as never);
  mock.method(overtimeServer, "getOvertimePolicyForHouse", async () => ({
    house_id: "house-1", timezone: "Asia/Manila", ot_mode: "AFTER_SCHEDULE_END",
    min_ot_minutes: 0, rounding_minutes: 1, rounding_mode: "NONE", created_at: "2026-01-01",
  }));
  mock.method(schedulesServer, "listScheduleTemplates", async () => [{ id: "template-a", house_id: "house-1", name: "Allowed Template", timezone: "Asia/Manila", created_at: "2026-01-01" }]);
  mock.method(schedulesServer, "getScheduleTemplateWithWindows", async () => ({ template: { id: "template-a", house_id: "house-1", name: "Allowed Template", timezone: "Asia/Manila", created_at: "2026-01-01" }, windows: [] }));
  mock.method(employeesServer, "listBranchesForHouse", async () => ({ branches: [{ id: "branch-a", name: "A" }, { id: "branch-b", name: "B" }] }));
  mock.method(schedulesServer, "listBranchScheduleAssignments", async () => []);
}

const readAccess = {
  allowed: true, allowedByRole: false, allowedByPolicy: true,
  policyKeys: ["tiles.hr.read"], isBranchLimited: true, allowedBranchIds: ["branch-a"],
};

describe("HrSchedulesPage mutation affordances", () => {
  afterEach(() => mock.restoreAll());

  it("keeps permitted data visible but hides every mutation form for read-only actors", async () => {
    setup(readAccess, { ...readAccess, allowed: false });
    const page = await HrSchedulesPage({ params: Promise.resolve({ slug: "demo" }) });
    assert.match(renderedText(page), /Allowed Template/);
    assert.match(renderedText(page), /read-only access/);
    assert.deepEqual(renderedActions(page), []);
  });

  it("keeps payroll-read schedule data visible without mutation forms", async () => {
    setup({ ...readAccess, policyKeys: ["tiles.payroll.read"] }, { ...readAccess, allowed: false });
    const page = await HrSchedulesPage({ params: Promise.resolve({ slug: "demo" }) });
    assert.match(renderedText(page), /Allowed Template/);
    assert.match(renderedText(page), /read-only access/);
    assert.deepEqual(renderedActions(page), []);
  });

  it("shows house-global and assignment controls for owner authority", async () => {
    setup({ allowed: true, allowedByRole: true, isBranchLimited: false, allowedBranchIds: [] }, { allowed: true, allowedByRole: true, isBranchLimited: false, allowedBranchIds: [] });
    const page = await HrSchedulesPage({ params: Promise.resolve({ slug: "demo" }) });
    const actions = renderedActions(page);
    assert.ok(actions.includes(createScheduleTemplateAction));
    assert.ok(actions.includes(addScheduleWindowAction));
    assert.ok(actions.includes(updateOvertimePolicyAction));
    assert.equal(actions.filter((action) => action === createBranchScheduleAssignmentAction).length, 2);
  });

  it("shows only allowed-branch assignment control for a branch-limited writer", async () => {
    setup(readAccess, { ...readAccess, allowed: true, evaluatedLevel: "write", evaluatedCapability: "hr" });
    const page = await HrSchedulesPage({ params: Promise.resolve({ slug: "demo" }) });
    const actions = renderedActions(page);
    assert.ok(!actions.includes(createScheduleTemplateAction));
    assert.ok(!actions.includes(addScheduleWindowAction));
    assert.ok(!actions.includes(updateOvertimePolicyAction));
    assert.equal(actions.filter((action) => action === createBranchScheduleAssignmentAction).length, 1);
  });
});
