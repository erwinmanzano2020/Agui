import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  HrBranchScheduleAssignmentRow,
  HrScheduleTemplateRow,
} from "@/lib/db.types";
import { evaluateHrAccess } from "../access";
import {
  createBranchScheduleAssignment,
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

class SupabaseMock {
  constructor(private data: SupabaseData) {}

  from(table: string) {
    if (table === "hr_schedule_templates") {
      return new TemplateQueryMock(this.data.templates);
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

describe("createBranchScheduleAssignment", () => {
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
