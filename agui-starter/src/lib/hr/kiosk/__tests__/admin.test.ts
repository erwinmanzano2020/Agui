import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import * as access from "@/lib/hr/access";
import {
  KioskAdminError,
  createKioskDeviceForBranch,
  listKioskDevicesForHouse,
  rotateKioskDeviceToken,
  setKioskDeviceEnabled,
} from "@/lib/hr/kiosk/admin";

function createSupabaseStub() {
  const state = {
    lastInsert: null as Record<string, unknown> | null,
    lastUpdate: null as Record<string, unknown> | null,
    branchHouseId: "house-1",
    deviceHouseId: "house-1",
    deviceBranchId: "branch-1",
    listRows: [
      {
        id: "device-1",
        house_id: "house-1",
        branch_id: "branch-1",
        name: "Frontdesk",
        is_active: true,
        created_at: new Date().toISOString(),
        last_seen_at: null,
        last_event_at: null,
        disabled_at: null,
        disabled_by: null,
        branch: { id: "branch-1", name: "Main Branch" },
      },
      {
        id: "device-2",
        house_id: "house-1",
        branch_id: "branch-2",
        name: "Kitchen",
        is_active: true,
        created_at: new Date().toISOString(),
        last_seen_at: null,
        last_event_at: null,
        disabled_at: null,
        disabled_by: null,
        branch: { id: "branch-2", name: "Kitchen Branch" },
      },
    ] as Array<Record<string, unknown>>,
    branchFilter: null as string | null,
    branchInFilter: null as string[] | null,
  };

  const supabase = {
    from(table: string) {
      return {
        _ordered: false,
        select() {
          return this;
        },
        eq(column: string, value: string) {
          if (table === "branches" && column === "house_id") state.branchHouseId = value;
          if (table === "hr_kiosk_devices" && column === "house_id") state.deviceHouseId = value;
          if (table === "hr_kiosk_devices" && column === "branch_id") state.branchFilter = value;
          return this;
        },
        in(column: string, values: string[]) {
          if (table === "hr_kiosk_devices" && column === "branch_id") state.branchInFilter = values;
          return this;
        },
        maybeSingle() {
          if (table === "branches") {
            return Promise.resolve({
              data: state.branchHouseId === "house-1" ? { id: "branch-1" } : null,
              error: null,
            });
          }
          if (table === "hr_kiosk_devices") {
            return Promise.resolve({
              data: state.deviceHouseId === "house-1"
                ? { id: "device-1", house_id: "house-1", branch_id: state.deviceBranchId }
                : null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        order() {
          this._ordered = true;
          return this;
        },
        insert(payload: Record<string, unknown>) {
          state.lastInsert = payload;
          return {
            select() {
              return this;
            },
            single() {
              return Promise.resolve({
                data: {
                  id: "device-1",
                  house_id: String(payload.house_id),
                  branch_id: String(payload.branch_id),
                  name: String(payload.name),
                  is_active: true,
                  created_at: new Date().toISOString(),
                  last_seen_at: null,
                  last_event_at: null,
                  disabled_at: null,
                  disabled_by: null,
                },
                error: null,
              });
            },
          };
        },
        update(payload: Record<string, unknown>) {
          state.lastUpdate = payload;
          return {
            eq() {
              return this;
            },
          };
        },
        then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) {
          if (table !== "hr_kiosk_devices" || !this._ordered) {
            return Promise.resolve(resolve({ data: [], error: null }));
          }
          const filtered = state.listRows.filter((row) => {
            const branch = String(row.branch_id);
            if (state.branchFilter && branch !== state.branchFilter) return false;
            if (state.branchInFilter && !state.branchInFilter.includes(branch)) return false;
            return true;
          });
          return Promise.resolve(resolve({ data: filtered, error: null }));
        },
      };
    },
  };

  return { supabase, state };
}

describe("kiosk admin", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
    mock.method(access, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      allowedByPolicy: false,
      allowedByRole: true,
      hasWorkspaceAccess: true,
      roles: ["house_manager"],
      normalizedRoles: ["manager"],
      policyKeys: [],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: false,
      allowedBranchIds: [],
    }));
  });

  afterEach(() => mock.restoreAll());

  it("denies when HR access is missing", async () => {
    mock.restoreAll();
    mock.method(access, "requireHrAccessWithBranch", async () => ({
      allowed: false,
      allowedByPolicy: false,
      allowedByRole: false,
      hasWorkspaceAccess: true,
      roles: [],
      normalizedRoles: [],
      policyKeys: [],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: false,
      allowedBranchIds: [],
    }));

    const { supabase } = createSupabaseStub();
    await assert.rejects(
      () => createKioskDeviceForBranch(supabase as never, { houseId: "house-1", branchId: "branch-1", name: "kiosk" }),
      (error: unknown) => error instanceof KioskAdminError && error.status === 403,
    );
  });

  it("prevents cross-house create", async () => {
    const { supabase } = createSupabaseStub();
    await assert.rejects(
      () => createKioskDeviceForBranch(supabase as never, { houseId: "house-2", branchId: "branch-1", name: "kiosk" }),
      (error: unknown) => error instanceof KioskAdminError && error.status === 403,
    );
  });

  it("returns plaintext token and stores hash", async () => {
    const { supabase, state } = createSupabaseStub();
    const result = await createKioskDeviceForBranch(supabase as never, {
      houseId: "house-1",
      branchId: "branch-1",
      name: "Frontdesk Android #1",
    });

    assert.ok(result.plaintextToken.length > 10);
    assert.notEqual(state.lastInsert?.token_hash, result.plaintextToken);
  });

  it("prevents cross-house rotate/disable", async () => {
    const { supabase } = createSupabaseStub();
    await assert.rejects(
      () => rotateKioskDeviceToken(supabase as never, { houseId: "house-2", deviceId: "device-1" }),
      (error: unknown) => error instanceof KioskAdminError && error.status === 404,
    );

    await assert.rejects(
      () => setKioskDeviceEnabled(supabase as never, { houseId: "house-2", deviceId: "device-1", enabled: false }),
      (error: unknown) => error instanceof KioskAdminError && error.status === 404,
    );
  });

  it("returns branch relation as an object for UI branch name display", async () => {
    const { supabase } = createSupabaseStub();

    const devices = await listKioskDevicesForHouse(supabase as never, "house-1");
    assert.equal(devices[0]?.branch?.name, "Main Branch");
  });

  it("filters list to assigned branch for branch-limited actors when branch filter is absent", async () => {
    mock.restoreAll();
    mock.method(access, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      allowedByPolicy: true,
      allowedByRole: false,
      hasWorkspaceAccess: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: ["tiles.hr.read", "tiles.hr.branch.00000000-0000-0000-0000-000000000001"],
      entityId: "entity-2",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: ["branch-1"],
    }));

    const { supabase } = createSupabaseStub();
    const rows = await listKioskDevicesForHouse(supabase as never, "house-1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.branch_id, "branch-1");
  });

  it("denies cross-branch mutation for branch-limited actors", async () => {
    mock.restoreAll();
    mock.method(access, "requireHrAccessWithBranch", async (_supabase: unknown, input: { branchId?: string | null }) => {
      const denied = input.branchId === "branch-2";
      return {
        allowed: !denied,
        allowedByPolicy: true,
        allowedByRole: false,
        hasWorkspaceAccess: true,
        roles: ["house_staff"],
        normalizedRoles: ["staff"],
        policyKeys: ["tiles.hr.read", "tiles.hr.branch.00000000-0000-0000-0000-000000000001"],
        entityId: "entity-2",
        branchId: input.branchId ?? null,
        isBranchLimited: true,
        allowedBranchIds: ["branch-1"],
      };
    });

    const { supabase, state } = createSupabaseStub();
    state.deviceBranchId = "branch-2";
    await assert.rejects(
      () => rotateKioskDeviceToken(supabase as never, { houseId: "house-1", deviceId: "device-1" }),
      (error: unknown) => error instanceof KioskAdminError && error.status === 403,
    );
  });
});
