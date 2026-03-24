export type DtrMutationState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
};

export const dtrMutationInitialState: DtrMutationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
