// Runtime helpers for pass issuance and rotation. Keep schema libraries out of module scope.

const ALLOWED_PASS_TYPES = ["alliance", "member", "staff"] as const;
const ALLOWED_CHANNELS = ["kiosk", "pos", "admin"] as const;

export const PASS_TYPES = ALLOWED_PASS_TYPES;
export const PASS_CHANNELS = ALLOWED_CHANNELS;

export type IssuePassInput = {
  memberId: string;
  passType: (typeof ALLOWED_PASS_TYPES)[number];
  channel?: (typeof ALLOWED_CHANNELS)[number];
  expiresInDays?: number;
  dryRun?: boolean;
};

export type IssuePassResult = {
  ok: true;
  pass: {
    id: string;
    memberId: string;
    passType: IssuePassInput["passType"];
    channel: IssuePassInput["channel"];
    issuedAt: string;
    expiresAt: string;
    dryRun: boolean;
  };
};

export async function issuePass(input: IssuePassInput): Promise<IssuePassResult> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  const days = Number.isFinite(input.expiresInDays) ? Math.max(1, Math.floor(input.expiresInDays!)) : 30;
  expiresAt.setDate(issuedAt.getDate() + days);

  return {
    ok: true,
    pass: {
      id: `pass_${Math.random().toString(36).slice(2, 10)}`,
      memberId: input.memberId,
      passType: input.passType,
      channel: input.channel ?? "admin",
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      dryRun: Boolean(input.dryRun),
    },
  };
}

export type RotatePassInput = {
  passId?: string;
  memberId?: string;
  reason?: string;
  dryRun?: boolean;
};

export type RotatePassResult = {
  ok: true;
  rotation: {
    id: string;
    rotationId: string;
    rotatedAt: string;
    reason?: string;
    dryRun: boolean;
  };
};

export async function rotatePass(input: RotatePassInput): Promise<RotatePassResult> {
  const id = input.passId || (input.memberId ? `pass_for_${input.memberId}` : "pass_unknown");
  const rotatedAt = new Date();

  return {
    ok: true,
    rotation: {
      id,
      rotationId: `rot_${Math.random().toString(36).slice(2, 10)}`,
      rotatedAt: rotatedAt.toISOString(),
      reason: input.reason,
      dryRun: Boolean(input.dryRun),
    },
  };
}

export function allowedPassTypes() {
  return [...ALLOWED_PASS_TYPES];
}

export function allowedChannels() {
  return [...ALLOWED_CHANNELS];
}
