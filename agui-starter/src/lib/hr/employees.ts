import type { EmployeeInsert, EmployeeRow, EmployeeUpdate } from "@/lib/db.types";
import type { WorkspaceRole } from "@/lib/tiles/types";
import { normalizeWorkspaceRole } from "@/lib/workspaces/roles";

export type EmployeeAccessContext = {
  houseId: string;
  roles: string[];
  policyKeys?: Iterable<string>;
};

export type EmployeeListFilters = {
  status?: EmployeeRow["status"] | "all";
  branchId?: string | null;
  search?: string;
};

export class EmployeeAccessError extends Error {}

const ALLOWED_ROLES = new Set<WorkspaceRole>(["owner", "manager"]);
const ALLOWED_POLICIES = new Set([
  "tiles.hr.read",
  "tiles.payroll.read",
  "domain.payroll.all",
]);

export function canManageEmployees(
  context: EmployeeAccessContext,
  targetHouseId: string,
): boolean {
  if (context.houseId !== targetHouseId) {
    return false;
  }

  const normalizedRoles = context.roles.map((role) => normalizeWorkspaceRole(role));
  const allowedByRole = normalizedRoles.some((role) => ALLOWED_ROLES.has(role));
  const allowedByPolicy = Array.from(context.policyKeys ?? []).some((key) =>
    ALLOWED_POLICIES.has(key),
  );

  return allowedByRole || allowedByPolicy;
}

function assertManageEmployees(context: EmployeeAccessContext, targetHouseId: string) {
  if (!canManageEmployees(context, targetHouseId)) {
    throw new EmployeeAccessError("Not allowed to manage employees for this house");
  }
}

export type EmployeeRepository = {
  listByHouse(houseId: string, filters?: EmployeeListFilters): Promise<EmployeeRow[]>;
  findById(id: string): Promise<EmployeeRow | null>;
  create(payload: EmployeeInsert): Promise<EmployeeRow>;
  update(id: string, updates: EmployeeUpdate): Promise<EmployeeRow | null>;
};

export function buildEmployeeRow(
  id: string,
  overrides: Partial<EmployeeRow> = {},
): EmployeeRow {
  const fullName = overrides.full_name ?? "Ada Lovelace";
  const code = overrides.code ?? `EMP-${id.slice(0, 6)}`;
  const rate = overrides.rate_per_day ?? 0;
  const now = new Date().toISOString();

  return {
    id,
    house_id: overrides.house_id ?? "house-1",
    code,
    full_name: fullName,
    rate_per_day: rate,
    status: overrides.status ?? "active",
    branch_id: overrides.branch_id ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  } satisfies EmployeeRow;
}

export function createInMemoryEmployeeRepository(initial?: {
  rows?: EmployeeRow[];
  branches?: Record<string, string>;
}): EmployeeRepository & {
  rows: EmployeeRow[];
} {
  let counter = 1;
  const rows = [...(initial?.rows ?? [])];
  const branches = initial?.branches ?? {};

  return {
    rows,
    async listByHouse(houseId, filters = {}) {
      const branchHouseMap = branches;
      if (filters.branchId) {
        const branchHouse = branchHouseMap[filters.branchId];
        if (branchHouse && branchHouse !== houseId) {
          return [];
        }
      }

      let filtered = rows.filter((row) => row.house_id === houseId);

      if (filters.status && filters.status !== "all") {
        filtered = filtered.filter((row) => row.status === filters.status);
      }

      if (filters.branchId) {
        filtered = filtered.filter((row) => row.branch_id === filters.branchId);
      }

      if (filters.search?.trim()) {
        const query = filters.search.trim().toLowerCase();
        filtered = filtered.filter((row) =>
          row.full_name.toLowerCase().includes(query) || row.code.toLowerCase().includes(query),
        );
      }

      return filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    async findById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async create(payload) {
      const now = payload.created_at ?? new Date().toISOString();
      if (payload.branch_id) {
        const branchHouse = branches[payload.branch_id];
        if (branchHouse && branchHouse !== payload.house_id) {
          throw new Error("Branch does not belong to the employee house");
        }
      }
      const fullName = (payload.full_name ?? "").trim() || "Unnamed";
      const code = payload.code ?? `EMP-${counter++}`;
      const rate = payload.rate_per_day ?? 0;
      const row: EmployeeRow = {
        id: payload.id ?? `emp-${counter++}`,
        house_id: payload.house_id,
        code,
        full_name: fullName,
        rate_per_day: rate,
        status: payload.status ?? "active",
        branch_id: payload.branch_id ?? null,
        created_at: now,
        updated_at: payload.updated_at ?? now,
      } satisfies EmployeeRow;
      rows.push(row);
      return row;
    },
    async update(id, updates) {
      const existing = rows.find((row) => row.id === id);
      if (!existing) return null;

      const merged: EmployeeRow = {
        ...existing,
        ...updates,
        code: updates.code ?? existing.code,
        full_name: updates.full_name?.trim() || existing.full_name,
        rate_per_day: updates.rate_per_day ?? existing.rate_per_day,
        updated_at: updates.updated_at ?? new Date().toISOString(),
      } satisfies EmployeeRow;

      if (merged.branch_id) {
        const branchHouse = branches[merged.branch_id];
        if (branchHouse && branchHouse !== merged.house_id) {
          throw new Error("Branch does not belong to the employee house");
        }
      }

      const index = rows.findIndex((row) => row.id === id);
      rows[index] = merged;
      return merged;
    },
  };
}

export async function listEmployees(
  repo: EmployeeRepository,
  context: EmployeeAccessContext,
  filters: EmployeeListFilters = {},
): Promise<EmployeeRow[]> {
  assertManageEmployees(context, context.houseId);
  return repo.listByHouse(context.houseId, filters);
}

export async function createEmployee(
  repo: EmployeeRepository,
  context: EmployeeAccessContext,
  payload: EmployeeInsert,
): Promise<EmployeeRow> {
  const houseId = payload.house_id ?? context.houseId;
  assertManageEmployees(context, houseId);
  const fullName = (payload.full_name ?? "").trim() || payload.code || "";
  const code = payload.code ?? `EMP-${Date.now()}`;
  return repo.create({
    ...payload,
    code,
    full_name: fullName || code,
    house_id: houseId,
  });
}

export async function getEmployee(
  repo: EmployeeRepository,
  context: EmployeeAccessContext,
  employeeId: string,
): Promise<EmployeeRow | null> {
  const row = await repo.findById(employeeId);
  if (!row) return null;
  assertManageEmployees(context, row.house_id);
  return row;
}

export async function updateEmployee(
  repo: EmployeeRepository,
  context: EmployeeAccessContext,
  employeeId: string,
  updates: EmployeeUpdate,
): Promise<EmployeeRow | null> {
  const existing = await repo.findById(employeeId);
  if (!existing) return null;
  assertManageEmployees(context, existing.house_id);

  if (updates.house_id && updates.house_id !== existing.house_id) {
    throw new EmployeeAccessError("Cannot move employee across houses");
  }

  return repo.update(employeeId, {
    ...updates,
    house_id: existing.house_id,
  });
}
