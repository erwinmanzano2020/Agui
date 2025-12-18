import type { EmployeeUpdateInput } from "@/lib/hr/employees-server";

export type UpdateEmployeeState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof EmployeeUpdateFormInput, string[]>>;
};

export type EmployeeUpdateFormInput = EmployeeUpdateInput & {
  houseId: string;
  houseSlug: string;
  employeeId: string;
};

export const updateEmployeeInitialState: UpdateEmployeeState = { status: "idle", fieldErrors: {} };
