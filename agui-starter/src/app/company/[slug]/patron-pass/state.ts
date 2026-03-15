export type IssuePatronPassState = {
  status: "idle" | "success" | "error" | "needs-override";
  message: string | null;
  entityId: string | null;
  higherCard: { scope: string; name: string; cardNo: string } | null;
  issuedCard: { cardNo: string; incognitoDefault: boolean } | null;
};

export const INITIAL_PATRON_PASS_STATE: IssuePatronPassState = {
  status: "idle",
  message: null,
  entityId: null,
  higherCard: null,
  issuedCard: null,
};
