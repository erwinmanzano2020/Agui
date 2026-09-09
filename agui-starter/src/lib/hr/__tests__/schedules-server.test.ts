import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import type {
  HrBranchScheduleAssignmentRow,
  HrScheduleTemplateRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import * as access from "../access";
import { evaluateHrAccess } from "../access";
import {
  createBranchScheduleAssignment,
  getScheduleTemplateWithWindows,
  listBranchScheduleAssignments,
  listScheduleTemplates,
  ScheduleAssignmentError,
} from "../schedules-server";

type QueryResult<T> = { data: T | null; error: { message: string } | null };

type BranchRow = { id: string; house_id: string | null };

type SupabaseData = {
  templates: HrScheduleTemplateRow[];
  branches: BranchRow[];
  assignments: HrBranchScheduleAssignmentRow[];
  windows?: HrScheduleWindowRow[];
};

class TemplateQueryMock {
  constructor(
    private rows: HrScheduleTemplateRow[],
    private filters: Partial<HrScheduleTemplateRow> = {},
    private result: QueryResult<HrScheduleTemplateRow[]> = { data: null, error: null },
  ) {}

  select() {
    return this;
  }

  eq(column: keyof HrScheduleTemplateRow, value: string) {
    return new TemplateQueryMock(this.rows, { ...this.filters, [column]: value }, this.result);
  }

  in(column: keyof HrScheduleTemplateRow, values: string[]) {
    return new TemplateQueryMock(this.rows.filter((row) => values.includes(String(row[column]))), this.filters, this.result);
  }

  async order(column: keyof HrScheduleTemplateRow) {
    const filtered = this.rows.filter((row) =>
      Object.entries(this.filters).every(([key, value]) =>
        (row as Record<string, unknown>)[key] === value,
      ),
    );
    const sorted = filtered.slice().sort((a, b) =>
      String(a[column]).localeCompare(String(b[column])),
    );
    return { data: sorted, error: this.result.error } as const;
  }

  async maybeSingle<T>() {
    const filtered = this.rows.filter((row) =>
      Object.entries(this.filters).every(([key, value]) =>
        (row as Record<string, unknown>)[key] === value,
      ),
    );
    return { data: (filtered[0] as T | null) ?? null, error: this.result.error } satisfies QueryResult<T>;
  }
}

class BranchQueryMock {
  constructor(private rows: BranchRow[], private filters: Partial<BranchRow> = {}) {}

  select() {
    return this;
  }

  eq(column: keyof BranchRow, value: string) {
    return new BranchQueryMock(this.rows, { ...this.filters, [column]: value });
  }

  async maybeSingle<T>() {
    const row = this.rows.find((branch) =>
      Object.entries(this.filters).every(([key, value]) =>
        (branch as Record<string, unknown>)[key] === value,
      ),
    );
    return { data: (row as T | null) ?? null, error: null } as const;
  }
}

class AssignmentQueryMock {
  constructor(
    private rows: HrBranchScheduleAssignmentRow[],
    private filters: Partial<HrBranchScheduleAssignmentRow> = {},
    private result: QueryResult<HrBranchScheduleAssignmentRow[]> = { data: null, error: null },
  ) {}

  select() {
    return this;
  }

  eq(column: keyof HrBranchScheduleAssignmentRow, value: string) {
    return new AssignmentQueryMock(this.rows, { ...this.filters, [column]: value }, this.result);
  }

  in(column: keyof HrBranchScheduleAssignmentRow, values: string[]) {
    return new AssignmentQueryMock(this.rows.filter((row) => values.includes(String(row[column]))), this.filters, this.result);
  }

  async order(column: keyof HrBranchScheduleAssignmentRow, options?: { ascending?: boolean }) {
    const filtered = this.rows.filter((row) =>
      Object.entries(this.filters).every(([key, value]) =>
        (row as Record<string, unknown>)[key] === value,
      ),
    );
    const sorted = filtered.slice().sort((a, b) =>
      options?.ascending === false
        ? String(b[column]).localeCompare(String(a[column]))
        : String(a[column]).localeCompare(String(b[column])),
    );
    return { data: sorted, error: this.result.error } as const;
  }

  insert(payload: Omit<HrBranchScheduleAssignmentRow, "id" | "created_at">) {
    return new AssignmentInsertQueryMock(payload);
  }
}

class AssignmentInsertQueryMock {
  constructor(private payload: Omit<HrBranchScheduleAssignmentRow, "id" | "created_at">) {}

  select() {
    return this;
  }

  async maybeSingle<T>() {
    return {
      data: {
        ...this.payload,
        id: "assignment-1",
        created_at: "2024-01-01T00:00:00Z",
      } as T,
      error: null,
    } as const;
  }
}

class WindowQueryMock {
  constructor(private rows: HrScheduleWindowRow[], private filters: Partial<HrScheduleWindowRow> = {}) {}
  select() { return this; }
  eq(column: keyof HrScheduleWindowRow, value: string) {
    return new WindowQueryMock(this.rows, { ...this.filters, [column]: value });
  }
  order() { return this; }
  then(resolve: (value: QueryResult<HrScheduleWindowRow[]>) => void) {
    const data = this.rows.filter((row) => Object.entries(this.filters).every(([key, value]) =>
      (row as Record<string, unknown>)[key] === value));
    resolve({ data, error: null });
  }
}

class SupabaseMock {
  constructor(private data: SupabaseData) {}

  from(table: string) {
    if (table === "hr_schedule_templates") {
      return new TemplateQueryMock(this.data.templates);
    }
    if (table === "hr_schedule_windows") {
      return new WindowQueryMock(this.data.windows ?? []);
    }
    if (table === "branches") {
      return new BranchQueryMock(this.data.branches);
    }
    if (table === "hr_branch_schedule_assignments") {
      return new AssignmentQueryMock(this.data.assignments);
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

const accessAllowed = evaluateHrAccess({ roles: ["house_owner"], policyKeys: [], entityId: "entity-1" });
const accessDenied = evaluateHrAccess({ roles: [], policyKeys: [], entityId: null });

const baseTemplate: HrScheduleTemplateRow = {
  id: "schedule-1",
  house_id: "house-1",
  name: "Opening",
  timezone: "Asia/Manila",
  created_at: "2024-01-01T00:00:00Z",
};

const baseAssignment: HrBranchScheduleAssignmentRow = {
  id: "assignment-1",
  house_id: "house-1",
  branch_id: "branch-1",
  schedule_id: "schedule-1",
  effective_from: "2024-01-01",
  created_at: "2024-01-01T00:00:00Z",
};

afterEach(() => {
  mock.restoreAll();
});

describe("listScheduleTemplates", () => {
  it("returns [] when no templates exist", async () => {
    const supabase = new SupabaseMock({ templates: [], branches: [], assignments: [] });

    const result = await listScheduleTemplates(supabase as never, "house-1", { access: accessAllowed });

    assert.deepEqual(result, []);
  });

  it("denies access for cross-house requests", async () => {
    const supabase = new SupabaseMock({ templates: [baseTemplate], branches: [], assignments: [] });

    const result = await listScheduleTemplates(supabase as never, "house-1", { access: accessDenied });

    assert.deepEqual(result, []);
  });
});

describe("branch-limited schedule template visibility", () => {
  const branchAccess = {
    ...evaluateHrAccess({ roles: ["house_staff"], policyKeys: ["tiles.hr.read"], entityId: "staff" }),
    allowed: true,
    isBranchLimited: true,
    allowedBranchIds: ["branch-a"],
  } as never;
  const templates = [
    { ...baseTemplate, id: "template-a", name: "A" },
    { ...baseTemplate, id: "shared", name: "Shared" },
    { ...baseTemplate, id: "template-b", name: "B" },
    { ...baseTemplate, id: "unassigned", name: "Unassigned" },
  ];
  const assignments = [
    { ...baseAssignment, id: "a1", branch_id: "branch-a", schedule_id: "template-a" },
    { ...baseAssignment, id: "a2", branch_id: "branch-a", schedule_id: "shared" },
    { ...baseAssignment, id: "a3", branch_id: "branch-b", schedule_id: "shared" },
    { ...baseAssignment, id: "a4", branch_id: "branch-b", schedule_id: "template-b" },
  ];
  const windows = templates.map((template, index) => ({
    id: `window-${index}`, house_id: "house-1", schedule_id: template.id,
    day_of_week: 1, start_time: "09:00", end_time: "17:00",
    break_start: null, break_end: null, created_at: "2024-01-01T00:00:00Z",
  } satisfies HrScheduleWindowRow));

  it("returns allowed and shared templates but hides other-branch and unassigned templates", async () => {
    const supabase = new SupabaseMock({ templates, assignments, branches: [], windows });
    const result = await listScheduleTemplates(supabase as never, "house-1", { access: branchAccess });
    assert.deepEqual(result.map((row) => row.id), ["template-a", "shared"]);
    const allowed = await getScheduleTemplateWithWindows(supabase as never, "house-1", "shared", { access: branchAccess });
    assert.equal(allowed?.template.id, "shared");
    assert.equal(allowed?.windows.length, 1);
  });

  it("fails closed for direct inaccessible and unassigned template lookups", async () => {
    const supabase = new SupabaseMock({ templates, assignments, branches: [], windows });
    assert.equal(await getScheduleTemplateWithWindows(supabase as never, "house-1", "template-b", { access: branchAccess }), null);
    assert.equal(await getScheduleTemplateWithWindows(supabase as never, "house-1", "unassigned", { access: branchAccess }), null);
  });

  it("returns empty without house-wide fallback when allowed branches have no assignments", async () => {
    const supabase = new SupabaseMock({ templates, assignments: assignments.filter((row) => row.branch_id === "branch-b"), branches: [], windows });
    assert.deepEqual(await listScheduleTemplates(supabase as never, "house-1", { access: branchAccess }), []);
  });

  it("preserves every house template and window for broad authority", async () => {
    const supabase = new SupabaseMock({ templates, assignments, branches: [], windows });
    const result = await listScheduleTemplates(supabase as never, "house-1", { access: accessAllowed });
    assert.equal(result.length, 4);
    const unassigned = await getScheduleTemplateWithWindows(supabase as never, "house-1", "unassigned", { access: accessAllowed });
    assert.equal(unassigned?.windows.length, 1);
  });
});

describe("createBranchScheduleAssignment", () => {
  it("uses branch-aware access for write mutations", async () => {
    const supabase = new SupabaseMock({
      templates: [baseTemplate],
      branches: [{ id: "branch-1", house_id: "house-1" }],
      assignments: [],
    });

    mock.method(access, "requireHrAccessWithBranch", async () => ({
      ...accessAllowed,
      allowed: false,
      branchId: "branch-1",
      isBranchLimited: true,
      allowedBranchIds: [],
    }));

    await assert.rejects(
      () =>
        createBranchScheduleAssignment(
          supabase as never,
          {
            houseId: "house-1",
            branchId: "branch-1",
            scheduleId: "schedule-1",
            effectiveFrom: "2024-10-01",
          },
        ),
      ScheduleAssignmentError,
    );
  });

  it("guards when schedule and branch are in different houses", async () => {
    const supabase = new SupabaseMock({
      templates: [
        {
          ...baseTemplate,
          id: "schedule-2",
          house_id: "house-2",
        },
      ],
      branches: [{ id: "branch-1", house_id: "house-1" }],
      assignments: [],
    });

    await assert.rejects(
      () =>
        createBranchScheduleAssignment(
          supabase as never,
          {
            houseId: "house-1",
            branchId: "branch-1",
            scheduleId: "schedule-2",
            effectiveFrom: "2024-10-01",
          },
          { access: accessAllowed },
        ),
      ScheduleAssignmentError,
    );
  });
});

describe("listBranchScheduleAssignments", () => {
  it("sorts assignments by effective_from descending", async () => {
    const supabase = new SupabaseMock({
      templates: [],
      branches: [],
      assignments: [
        baseAssignment,
        { ...baseAssignment, id: "assignment-2", effective_from: "2024-03-01" },
        { ...baseAssignment, id: "assignment-3", effective_from: "2024-06-15" },
      ],
    });

    const result = await listBranchScheduleAssignments(supabase as never, "house-1", undefined, {
      access: accessAllowed,
    });

    assert.deepEqual(
      result.map((row) => row.effective_from),
      ["2024-06-15", "2024-03-01", "2024-01-01"],
    );
  });
});
