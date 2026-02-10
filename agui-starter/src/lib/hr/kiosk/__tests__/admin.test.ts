import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import * as access from "@/lib/hr/access";
import {
  KioskAdminError,
  createKioskDeviceForBranch,
  rotateKioskDeviceToken,
  setKioskDeviceEnabled,
} from "@/lib/hr/kiosk/admin";

function createSupabaseStub() {
  const state = {
    lastInsert: null as Record<string, unknown> | null,
    lastUpdate: null as Record<string, unknown> | null,
    branchHouseId: "house-1",
    deviceHouseId: "house-1",
  };

  const supabase = {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          if (table === "branches" && column === "house_id") state.branchHouseId = value;
          if (table === "hr_kiosk_devices" && column === "house_id") state.deviceHouseId = value;
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
              data: state.deviceHouseId === "house-1" ? { id: "device-1", house_id: "house-1" } : null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
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
      };
    },
  };

  return { supabase, state };
}

describe("kiosk admin", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
    mock.method(access, "requireHrAccess", async () => ({
      allowed: true,
      allowedByPolicy: false,
      allowedByRole: true,
      hasWorkspaceAccess: true,
      roles: ["house_manager"],
      normalizedRoles: ["manager"],
      policyKeys: [],
      entityId: "entity-1",
    }));
  });

  afterEach(() => mock.restoreAll());

  it("denies when HR access is missing", async () => {
    mock.restoreAll();
    mock.method(access, "requireHrAccess", async () => ({
      allowed: false,
      allowedByPolicy: false,
      allowedByRole: false,
      hasWorkspaceAccess: true,
      roles: [],
      normalizedRoles: [],
      policyKeys: [],
      entityId: "entity-1",
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
});
