import type { SupabaseClient } from "@supabase/supabase-js";

import type { KioskRepo } from "@/lib/hr/kiosk/service";

export function createSupabaseKioskRepo(supabase: SupabaseClient): KioskRepo {
  return {
    async findDeviceByTokenHash(tokenHash) {
      const { data, error } = await supabase
        .from("hr_kiosk_devices")
        .select("id, house_id, branch_id, is_active")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async touchDevice(deviceId) {
      const { error } = await supabase
        .from("hr_kiosk_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", deviceId);
      if (error) throw new Error(error.message);
    },

    async findEmployeeById(employeeId) {
      const { data, error } = await supabase
        .from("employees")
        .select("id, house_id, code, full_name")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async applyAttendanceScan({
      houseId,
      branchId,
      deviceId,
      employeeId,
      operationId,
      occurredAt,
    }) {
      const { data, error } = await supabase.rpc("hr_apply_kiosk_attendance_scan", {
        p_house_id: houseId,
        p_branch_id: branchId,
        p_device_id: deviceId,
        p_employee_id: employeeId,
        p_operation_id: operationId,
        p_occurred_at: occurredAt,
      });
      if (error) throw new Error(error.message);

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Canonical kiosk command returned an invalid result.");
      }

      const value = data as Record<string, unknown>;
      const action = value.action;
      const workDate = value.workDate;
      const segmentId = value.segmentId;
      if (
        (action !== "clock_in" && action !== "clock_out" && action !== "debounced") ||
        typeof workDate !== "string" ||
        (segmentId !== null && typeof segmentId !== "string")
      ) {
        throw new Error("Canonical kiosk command returned an invalid result.");
      }

      return {
        action,
        segmentId,
        factId: typeof value.factId === "string" ? value.factId : null,
        valueRevision:
          typeof value.valueRevision === "number" ? value.valueRevision : null,
        evidenceBasisRevision:
          typeof value.evidenceBasisRevision === "number"
            ? value.evidenceBasisRevision
            : null,
        employeeGeneration:
          typeof value.employeeGeneration === "number"
            ? value.employeeGeneration
            : null,
        workDate,
        multipleOpenSegments: value.multipleOpenSegments === true,
        replayed: value.replayed === true,
      };
    },

    async insertKioskEvent({ deviceId, houseId, branchId, employeeId, eventType, occurredAt, metadata }) {
      const { error } = await supabase.from("hr_kiosk_events").insert({
        device_id: deviceId,
        house_id: houseId,
        branch_id: branchId,
        employee_id: employeeId ?? null,
        event_type: eventType,
        occurred_at: occurredAt,
        metadata: metadata ?? {},
      });
      if (error) throw new Error(error.message);

      const { error: updateDeviceError } = await supabase
        .from("hr_kiosk_devices")
        .update({ last_event_at: occurredAt })
        .eq("id", deviceId)
        .eq("house_id", houseId);
      if (updateDeviceError) throw new Error(updateDeviceError.message);
    },

  };
}
