"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccess } from "@/lib/hr/access";
import {
  EmployeeUpdateError,
  updateEmployeeForHouseWithAccess,
} from "@/lib/hr/employees-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";
import { type UpdateEmployeeState } from "./action-types";

const StatusSchema = z.enum(["active", "inactive"]);

const EmployeeUpdateSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  employeeId: z.string().trim().min(1, "Missing employee reference"),
  full_name: z
    .string()
    .trim()
    .min(2, "Name is required")
    .max(200, "Name is too long"),
  status: StatusSchema,
  branch_id: z.string().trim().optional(),
  rate_per_day: z.number(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateEmployeeAction(
  _prevState: UpdateEmployeeState,
  formData: FormData,
): Promise<UpdateEmployeeState> {
  const branchIdRaw = formData.get("branch_id");
  const branchId = typeof branchIdRaw === "string" ? branchIdRaw.trim() : "";
  const rateRaw = formData.get("rate_per_day");
  const parsedRate =
    typeof rateRaw === "string"
      ? Number.parseFloat(rateRaw)
      : typeof rateRaw === "number"
        ? rateRaw
        : Number.NaN;

  const parsed = EmployeeUpdateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    employeeId: formData.get("employeeId"),
    full_name: formData.get("full_name"),
    status: formData.get("status"),
    branch_id: branchId || undefined,
    rate_per_day: parsedRate,
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      status: "error",
      fieldErrors: {},
      message: flattened.formErrors[0] ?? "Fix the highlighted fields and try again.",
    } satisfies UpdateEmployeeState;
  }

  const { houseId, houseSlug, employeeId, ...payload } = parsed.data;
  const normalizedBranchId = payload.branch_id?.trim() || null;

  if (normalizedBranchId && !UUID_REGEX.test(normalizedBranchId)) {
    return {
      status: "error",
      fieldErrors: { branch_id: ["Choose a branch within this workspace"] },
      message: "Fix the highlighted fields and try again.",
    } satisfies UpdateEmployeeState;
  }

  if (!Number.isFinite(payload.rate_per_day) || payload.rate_per_day < 0) {
    return {
      status: "error",
      fieldErrors: { rate_per_day: ["Rate must be at least 0"] },
      message: "Fix the highlighted fields and try again.",
    } satisfies UpdateEmployeeState;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { status: "error", message: "Authentication required." };
  }

  const access = await requireHrAccess(supabase, houseId);
  if (!access.allowed) {
    return { status: "error", message: "You are not allowed to edit this employee." } satisfies UpdateEmployeeState;
  }

  const service = getServiceSupabase();

  try {
    const updated = await updateEmployeeForHouseWithAccess(service, access, houseId, employeeId, {
      ...payload,
      branch_id: normalizedBranchId,
    });

    if (!updated) {
      return { status: "error", message: "Employee not found." } satisfies UpdateEmployeeState;
    }

    revalidatePath(`/company/${houseSlug}/hr/employees`);
    revalidatePath(`/company/${houseSlug}/hr/employees/${employeeId}`);

    return { status: "success", message: "Employee updated." } satisfies UpdateEmployeeState;
  } catch (error) {
    if (error instanceof EmployeeUpdateError) {
      return {
        status: "error",
        message: "Select a branch within this house.",
        fieldErrors: { branch_id: ["Choose a branch for this workspace"] },
      } satisfies UpdateEmployeeState;
    }

    console.error("Failed to update employee", error);
    return { status: "error", message: "Unable to save changes right now." } satisfies UpdateEmployeeState;
  }
}
