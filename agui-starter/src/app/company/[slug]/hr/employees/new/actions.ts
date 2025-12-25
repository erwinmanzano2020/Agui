"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccess } from "@/lib/hr/access";
import {
  EmployeeCreateError,
  EmployeeDuplicateIdentityError,
  EmployeeUpdateError,
  createEmployeeForHouseWithAccess,
} from "@/lib/hr/employees-server";
import {
  findOrCreateEntityForEmployee,
  normalizeEmployeeEmail,
  normalizeEmployeePhoneDetails,
} from "@/lib/hr/employee-identity";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

import type { CreateEmployeeState } from "./action-types";

const StatusSchema = z.enum(["active", "inactive"]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EmailSchema = z.string().trim().regex(EMAIL_REGEX, "Enter a valid email").optional();
const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9()[\]\s.-]{6,}$/, "Enter a valid phone number")
  .optional();

const CreateEmployeeSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  full_name: z
    .string()
    .trim()
    .min(2, "Name is required")
    .max(200, "Name is too long"),
  status: StatusSchema.default("active").optional(),
  branch_id: z.string().trim().optional(),
  rate_per_day: z.number(),
  email: EmailSchema,
  phone: PhoneSchema,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createEmployeeAction(
  _prevState: CreateEmployeeState,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const branchIdRaw = formData.get("branch_id");
  const branchId = typeof branchIdRaw === "string" ? branchIdRaw.trim() : "";
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const phoneRaw = formData.get("phone");
  const phone = typeof phoneRaw === "string" ? phoneRaw.trim() : "";
  const rateRaw = formData.get("rate_per_day");
  const parsedRate =
    typeof rateRaw === "string"
      ? Number.parseFloat(rateRaw)
      : typeof rateRaw === "number"
        ? rateRaw
        : Number.NaN;

  const parsed = CreateEmployeeSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    full_name: formData.get("full_name"),
    status: formData.get("status") || "active",
    branch_id: branchId || undefined,
    rate_per_day: parsedRate,
    email: email || undefined,
    phone: phone || undefined,
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      status: "error",
      fieldErrors: {},
      message: flattened.formErrors[0] ?? "Fix the highlighted fields and try again.",
    } satisfies CreateEmployeeState;
  }

  if (!Number.isFinite(parsed.data.rate_per_day) || parsed.data.rate_per_day <= 0) {
    return {
      status: "error",
      fieldErrors: { rate_per_day: ["Rate must be greater than 0"] },
      message: "Fix the highlighted fields and try again.",
    } satisfies CreateEmployeeState;
  }

  const normalizedBranchId = parsed.data.branch_id?.trim() || null;
  if (normalizedBranchId && !UUID_REGEX.test(normalizedBranchId)) {
    return {
      status: "error",
      fieldErrors: { branch_id: ["Choose a branch within this workspace"] },
      message: "Fix the highlighted fields and try again.",
    } satisfies CreateEmployeeState;
  }

  const normalizedEmail = normalizeEmployeeEmail(parsed.data.email ?? null);
  if (parsed.data.email && !normalizedEmail) {
    return {
      status: "error",
      fieldErrors: { email: ["Enter a valid email"] },
      message: "Fix the highlighted fields and try again.",
    } satisfies CreateEmployeeState;
  }

  const normalizedPhone = normalizeEmployeePhoneDetails(parsed.data.phone ?? null);
  if (parsed.data.phone && !normalizedPhone) {
    return {
      status: "error",
      fieldErrors: { phone: ["Enter a valid phone number"] },
      message: "Fix the highlighted fields and try again.",
    } satisfies CreateEmployeeState;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { status: "error", message: "Authentication required." };
  }

  const access = await requireHrAccess(supabase, parsed.data.houseId);
  if (!access.allowed) {
    return { status: "error", message: "You are not allowed to add employees for this house." } satisfies CreateEmployeeState;
  }

  let entityId: string | null = null;
  try {
    const entityResult = await findOrCreateEntityForEmployee(supabase, {
      houseId: parsed.data.houseId,
      fullName: parsed.data.full_name,
      email: normalizedEmail,
      phone: normalizedPhone?.e164 ?? null,
    });
    entityId = entityResult.entityId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link employee identity right now.";
    if (message.toLowerCase().includes("not allowed")) {
      return { status: "error", message: "You are not allowed to create identities for this house." } satisfies CreateEmployeeState;
    }
    console.error("Failed to resolve employee entity", error);
    return { status: "error", message } satisfies CreateEmployeeState;
  }

  try {
    const created = await createEmployeeForHouseWithAccess(supabase, access, parsed.data.houseId, {
      full_name: parsed.data.full_name,
      status: parsed.data.status ?? "active",
      branch_id: normalizedBranchId,
      rate_per_day: parsed.data.rate_per_day,
      entity_id: entityId,
    });

    const listPath = `/company/${parsed.data.houseSlug}/hr/employees`;
    revalidatePath(listPath);

    return { status: "success", createdEmployeeId: created.id, message: "Employee created." } satisfies CreateEmployeeState;
  } catch (error) {
    if (error instanceof EmployeeUpdateError) {
      return {
        status: "error",
        message: "Select a branch within this house.",
        fieldErrors: { branch_id: ["Choose a branch for this workspace"] },
      } satisfies CreateEmployeeState;
    }

    if (error instanceof EmployeeDuplicateIdentityError) {
      return {
        status: "error",
        message: "An active employee with this identity already exists in this house.",
      } satisfies CreateEmployeeState;
    }

    if (error instanceof EmployeeCreateError) {
      return { status: "error", message: error.message } satisfies CreateEmployeeState;
    }

    console.error("Failed to create employee", error);
    return { status: "error", message: "Unable to create employee right now." } satisfies CreateEmployeeState;
  }
}
