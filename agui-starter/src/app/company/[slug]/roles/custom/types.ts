export type CreateRoleState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const createRoleInitialState: CreateRoleState = { status: "idle" };

export type CreateRoleAction = (
  prevState: CreateRoleState,
  formData: FormData,
) => Promise<CreateRoleState>;
