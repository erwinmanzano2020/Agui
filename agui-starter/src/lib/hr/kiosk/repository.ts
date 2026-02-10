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

    async touchDevice(deviceId, seenAt) {
      const { error } = await supabase
        .from("hr_kiosk_devices")
        .update({ last_seen_at: seenAt })
        .eq("id", deviceId);
      if (error) throw new Error(error.message);
    },

    async findEmployeeById(employeeId) {
      const { data, error } = await supabase
        .from("employees")
        .select("id, house_id, code, first_name, last_name, full_name")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async findOpenSegments(employeeId) {
      const { data, error } = await supabase
        .from("dtr_segments")
        .select("id, employee_id, house_id, work_date, time_in, time_out, status")
        .eq("employee_id", employeeId)
        .eq("status", "open")
        .is("time_out", null)
        .order("time_in", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    async closeSegment(segmentId, timeOut) {
      const { data, error } = await supabase
        .from("dtr_segments")
        .update({ time_out: timeOut, status: "closed" })
        .eq("id", segmentId)
        .select("id, employee_id, house_id, work_date, time_in, time_out, status")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async createOpenSegment({ houseId, employeeId, workDate, timeIn }) {
      const { data, error } = await supabase
        .from("dtr_segments")
        .insert({
          house_id: houseId,
          employee_id: employeeId,
          work_date: workDate,
          time_in: timeIn,
          source: "system",
          status: "open",
        })
        .select("id, employee_id, house_id, work_date, time_in, time_out, status")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async findLatestEmployeeEvent(houseId, employeeId) {
      const { data, error } = await supabase
        .from("hr_kiosk_events")
        .select("occurred_at")
        .eq("house_id", houseId)
        .eq("employee_id", employeeId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async insertKioskEvent({ houseId, branchId, employeeId, eventType, occurredAt, metadata }) {
      const { error } = await supabase.from("hr_kiosk_events").insert({
        house_id: houseId,
        branch_id: branchId,
        employee_id: employeeId ?? null,
        event_type: eventType,
        occurred_at: occurredAt,
        metadata: metadata ?? {},
      });
      if (error) throw new Error(error.message);
    },

    async hasSyncClientEventId(houseId, branchId, clientEventId) {
      const { data, error } = await supabase
        .from("hr_kiosk_events")
        .select("id")
        .eq("house_id", houseId)
        .eq("branch_id", branchId)
        .eq("event_type", "sync_success")
        .eq("metadata->>clientEventId", clientEventId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data?.id);
    },
  };
}
