export type CreateEmployeeState = {
  status: "idle" | "success" | "error";
  message?: string;
  conflict?: { employeeId?: string | null; code?: string | null; fullName?: string | null };
  fieldErrors?: Partial<
    Record<"full_name" | "status" | "branch_id" | "rate_per_day" | "position_title" | "photo_url" | "photo_path" | "email" | "phone", string[]>
  >;
  createdEmployeeId?: string;
  selectedEntityId?: string | null;
};

export const createEmployeeInitialState: CreateEmployeeState = { status: "idle" };
