import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getEmployeeIdCardById, listEmployeeIdCards } from "@/lib/hr/employee-id-cards-server";

type EmployeeRowLite = {
  id: string;
  code: string;
  full_name: string;
  position_title: string | null;
  house_id: string;
  branch_id: string | null;
  status: "active" | "inactive";
};

class QueryMock {
  constructor(
    private readonly table: string,
    private readonly db: MockDb,
    private selected = "",
    private filters: Record<string, string> = {},
  ) {}

  select(columns: string) {
    return new QueryMock(this.table, this.db, columns, this.filters);
  }

  eq(column: string, value: string) {
    return new QueryMock(this.table, this.db, this.selected, { ...this.filters, [column]: value });
  }

  ilike() {
    return this;
  }

  order() {
    if (this.table === "employees") {
      return Promise.resolve({ data: this.db.employees.filter((row) => row.house_id === this.filters.house_id), error: null } as const);
    }
    if (this.table === "branches") {
      return Promise.resolve({ data: this.db.branches.filter((row) => row.house_id === this.filters.house_id), error: null } as const);
    }
    throw new Error(`Unsupported table ${this.table} for order()`);
  }

  async maybeSingle<T>() {
    if (this.table === "houses") {
      return { data: this.db.house, error: null } as const;
    }

    if (this.table === "employees" && this.selected.includes("branches(")) {
      return {
        data: { branches: { name: this.db.branches.find((b) => b.id === this.filters.id)?.name ?? null } } as T,
        error: null,
      } as const;
    }

    if (this.table === "employees") {
      const row = this.db.employees.find((item) => item.id === this.filters.id && item.house_id === this.filters.house_id) ?? null;
      return { data: row as T | null, error: null } as const;
    }

    throw new Error(`Unsupported table ${this.table} for maybeSingle()`);
  }
}

type MockDb = {
  employees: EmployeeRowLite[];
  house: { id: string; name: string; logo_url: string | null };
  branches: Array<{ id: string; house_id: string; name: string | null }>;
};

class SupabaseMock {
  constructor(private readonly db: MockDb) {}

  from(table: string) {
    if (!["employees", "houses", "branches"].includes(table)) {
      throw new Error(`Unexpected table ${table}`);
    }
    return new QueryMock(table, this.db);
  }
}

describe("employee-id-cards-server", () => {
  it("uses employees.position_title when entity_id is null", async () => {
    const supabase = new SupabaseMock({
      employees: [
        {
          id: "emp-1",
          code: "EI-001",
          full_name: "Ada Lovelace",
          position_title: "Store Supervisor",
          house_id: "house-1",
          branch_id: "branch-1",
          status: "active",
        },
      ],
      house: { id: "house-1", name: "Demo House", logo_url: null },
      branches: [{ id: "branch-1", house_id: "house-1", name: "Main Branch" }],
    });

    const card = await getEmployeeIdCardById(supabase as never, "house-1", "emp-1");

    assert.ok(card);
    assert.equal(card?.position, "Store Supervisor");
    assert.equal(card?.fullName, "Ada Lovelace");
  });

  it("lists cards without querying employments", async () => {
    const supabase = new SupabaseMock({
      employees: [
        {
          id: "emp-1",
          code: "EI-001",
          full_name: "Ada Lovelace",
          position_title: "Cashier",
          house_id: "house-1",
          branch_id: null,
          status: "active",
        },
      ],
      house: { id: "house-1", name: "Demo House", logo_url: null },
      branches: [],
    });

    const cards = await listEmployeeIdCards(supabase as never, "house-1");
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.position, "Cashier");
  });
});
