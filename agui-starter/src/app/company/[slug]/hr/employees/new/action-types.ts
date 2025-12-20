export type CreateEmployeeState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"full_name" | "status" | "branch_id" | "rate_per_day" | "email" | "phone", string[]>
  >;
  createdEmployeeId?: string;
};

export const createEmployeeInitialState: CreateEmployeeState = { status: "idle" };
