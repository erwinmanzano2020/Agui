import type { PseudoQrMatrix } from "@/lib/passes/qr";

export type MemberPassState = {
  status: "idle" | "success" | "error";
  token: string | null;
  matrix: PseudoQrMatrix;
  message: string | null;
};

export const INITIAL_MEMBER_PASS_STATE: MemberPassState = {
  status: "idle",
  token: null,
  matrix: [],
  message: null,
};
