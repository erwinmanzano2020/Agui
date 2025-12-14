import type { EmployeeInsert, EmployeeRow, EmployeeUpdate } from "@/lib/db.types";
import type { WorkspaceRole } from "@/lib/tiles/types";
import { normalizeWorkspaceRole } from "@/lib/workspaces/roles";

export type EmployeeAccessContext = {
  houseId: string;
  roles: string[];
  policyKeys?: Iterable<string>;
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
  listByHouse(houseId: string): Promise<EmployeeRow[]>;
  findById(id: string): Promise<EmployeeRow | null>;
  create(payload: EmployeeInsert): Promise<EmployeeRow>;
  update(id: string, updates: EmployeeUpdate): Promise<EmployeeRow | null>;
};

export function buildEmployeeRow(
  id: string,
  overrides: Partial<EmployeeRow> = {},
): EmployeeRow {
  const firstName = overrides.first_name ?? "Ada";
  const lastName = overrides.last_name ?? "Lovelace";
  const now = new Date().toISOString();

  return {
    id,
    house_id: overrides.house_id ?? "house-1",
    first_name: firstName,
    last_name: lastName,
    display_name: overrides.display_name ?? `${firstName} ${lastName}`.trim(),
    status: overrides.status ?? "active",
    employment_type: overrides.employment_type ?? "full_time",
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
    async listByHouse(houseId) {
      return rows.filter((row) => row.house_id === houseId);
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
      const row: EmployeeRow = {
        id: payload.id ?? `emp-${counter++}`,
        house_id: payload.house_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        display_name:
          payload.display_name ?? `${payload.first_name} ${payload.last_name}`.trim(),
        status: payload.status ?? "active",
        employment_type: payload.employment_type ?? "full_time",
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
        display_name:
          updates.display_name ??
          `${updates.first_name ?? existing.first_name} ${updates.last_name ?? existing.last_name}`.trim(),
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
): Promise<EmployeeRow[]> {
  assertManageEmployees(context, context.houseId);
  return repo.listByHouse(context.houseId);
}

export async function createEmployee(
  repo: EmployeeRepository,
  context: EmployeeAccessContext,
  payload: EmployeeInsert,
): Promise<EmployeeRow> {
  const houseId = payload.house_id ?? context.houseId;
  assertManageEmployees(context, houseId);
  const displayName = payload.display_name ?? `${payload.first_name} ${payload.last_name}`.trim();
  return repo.create({ ...payload, house_id: houseId, display_name: displayName });
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

  const displayName =
    updates.display_name ??
    `${updates.first_name ?? existing.first_name} ${updates.last_name ?? existing.last_name}`.trim();

  return repo.update(employeeId, {
    ...updates,
    house_id: existing.house_id,
    display_name: displayName,
  });
}
