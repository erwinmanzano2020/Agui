export type ApplyToGuildFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const INITIAL_APPLY_TO_GUILD_STATE: ApplyToGuildFormState = { status: "idle" };
