export const DIRECT_AUTH_ACTIONS = {
  context: "MOBILE_DIRECT_CONTEXT",
  login: "MOBILE_DIRECT_LOGIN",
  session: "MOBILE_DIRECT_SESSION",
  logout: "MOBILE_DIRECT_LOGOUT",
} as const;

export type DirectAuthFailure = {
  ok: false;
  code: string;
  message: string;
};

export type DirectDeviceContext = {
  deviceId: string;
  deviceLabel: string;
  ownership: "COMPANY";
  sharedDevice: true;
  requiresStaffPin: true;
  active: true;
  defaultBranch: string | null;
  defaultStation: string | null;
  allowedRoles: string[];
};

export type DirectDeviceContextSuccess = {
  ok: true;
  action: typeof DIRECT_AUTH_ACTIONS.context;
  mode: "DIRECT_DEVICE_CONTEXT";
  device: DirectDeviceContext;
  rules: {
    loginEnabled: true;
  };
};

export type DirectStaffSession = {
  sessionId: string;
  sessionType: "SHARED DEVICE";
  deviceId: string;
  deviceLabel: string;
  employeeId: string;
  employeeName: string;
  roleUsed: string;
  branch: string | null;
  station: string | null;
  sessionStatus: "ACTIVE";
  pinVerified: true;
};

export type DirectLoginSuccess = {
  ok: true;
  action: typeof DIRECT_AUTH_ACTIONS.login;
  mode: "DIRECT_STAFF_SESSION";
  session: DirectStaffSession;
};

export type DirectSessionSuccess = {
  ok: true;
  action: typeof DIRECT_AUTH_ACTIONS.session;
  mode: "DIRECT_STAFF_SESSION";
  session: DirectStaffSession;
};

export type DirectLogoutSuccess = {
  ok: true;
  action: typeof DIRECT_AUTH_ACTIONS.logout;
  mode: "DIRECT_STAFF_SESSION";
  sessionId: string;
  status: "CLOSED";
};

export type DirectDeviceContextResponse = DirectDeviceContextSuccess | DirectAuthFailure;
export type DirectLoginResponse = DirectLoginSuccess | DirectAuthFailure;
export type DirectSessionResponse = DirectSessionSuccess | DirectAuthFailure;
export type DirectLogoutResponse = DirectLogoutSuccess | DirectAuthFailure;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return nonEmptyString(value);
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => nonEmptyString(item));
  return normalized.every((item): item is string => Boolean(item)) ? normalized : null;
}

export function normalizeDirectDeviceId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,79}$/.test(normalized) ? normalized : null;
}

export function normalizeDirectEmployeeId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalized) ? normalized : null;
}

export function normalizeDirectStaffPin(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^\d{4,8}$/.test(normalized) ? normalized : null;
}

export function isDirectAuthFailure(value: unknown): value is DirectAuthFailure {
  return (
    isRecord(value) &&
    value.ok === false &&
    Boolean(nonEmptyString(value.code)) &&
    Boolean(nonEmptyString(value.message))
  );
}

export function parseDirectDeviceContextSuccess(
  value: unknown,
  expectedDeviceId: string,
): DirectDeviceContextSuccess | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.action !== DIRECT_AUTH_ACTIONS.context || value.mode !== "DIRECT_DEVICE_CONTEXT") return null;
  if (!isRecord(value.device) || !isRecord(value.rules) || value.rules.loginEnabled !== true) return null;

  const deviceId = normalizeDirectDeviceId(value.device.deviceId);
  const deviceLabel = nonEmptyString(value.device.deviceLabel);
  const allowedRoles = stringList(value.device.allowedRoles);
  if (!deviceId || deviceId !== expectedDeviceId || !deviceLabel || !allowedRoles) return null;
  if (
    value.device.ownership !== "COMPANY" ||
    value.device.sharedDevice !== true ||
    value.device.requiresStaffPin !== true ||
    value.device.active !== true
  ) {
    return null;
  }

  return {
    ok: true,
    action: DIRECT_AUTH_ACTIONS.context,
    mode: "DIRECT_DEVICE_CONTEXT",
    device: {
      deviceId,
      deviceLabel,
      ownership: "COMPANY",
      sharedDevice: true,
      requiresStaffPin: true,
      active: true,
      defaultBranch: nullableString(value.device.defaultBranch),
      defaultStation: nullableString(value.device.defaultStation),
      allowedRoles,
    },
    rules: { loginEnabled: true },
  };
}

function parseDirectStaffSession(
  value: unknown,
  expected: { deviceId: string; employeeId: string; sessionId?: string },
): DirectStaffSession | null {
  if (!isRecord(value)) return null;

  const sessionId = nonEmptyString(value.sessionId);
  const deviceId = normalizeDirectDeviceId(value.deviceId);
  const deviceLabel = nonEmptyString(value.deviceLabel);
  const employeeId = normalizeDirectEmployeeId(value.employeeId);
  const employeeName = nonEmptyString(value.employeeName);
  const roleUsed = nonEmptyString(value.roleUsed);
  if (!sessionId || !deviceId || !deviceLabel || !employeeId || !employeeName || !roleUsed) return null;
  if (deviceId !== expected.deviceId || employeeId !== expected.employeeId) return null;
  if (expected.sessionId && sessionId !== expected.sessionId) return null;
  if (value.sessionType !== "SHARED DEVICE" || value.sessionStatus !== "ACTIVE" || value.pinVerified !== true) return null;

  return {
    sessionId,
    sessionType: "SHARED DEVICE",
    deviceId,
    deviceLabel,
    employeeId,
    employeeName,
    roleUsed,
    branch: nullableString(value.branch),
    station: nullableString(value.station),
    sessionStatus: "ACTIVE",
    pinVerified: true,
  };
}

export function parseDirectLoginSuccess(
  value: unknown,
  expected: { deviceId: string; employeeId: string },
): DirectLoginSuccess | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.action !== DIRECT_AUTH_ACTIONS.login || value.mode !== "DIRECT_STAFF_SESSION") return null;
  const session = parseDirectStaffSession(value.session, expected);
  return session
    ? { ok: true, action: DIRECT_AUTH_ACTIONS.login, mode: "DIRECT_STAFF_SESSION", session }
    : null;
}

export function parseDirectSessionSuccess(
  value: unknown,
  expected: { sessionId: string; deviceId: string; employeeId: string },
): DirectSessionSuccess | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.action !== DIRECT_AUTH_ACTIONS.session || value.mode !== "DIRECT_STAFF_SESSION") return null;
  const session = parseDirectStaffSession(value.session, expected);
  return session
    ? { ok: true, action: DIRECT_AUTH_ACTIONS.session, mode: "DIRECT_STAFF_SESSION", session }
    : null;
}

export function parseDirectLogoutSuccess(value: unknown, expectedSessionId: string): DirectLogoutSuccess | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.action !== DIRECT_AUTH_ACTIONS.logout || value.mode !== "DIRECT_STAFF_SESSION") return null;
  const sessionId = nonEmptyString(value.sessionId);
  if (!sessionId || sessionId !== expectedSessionId || value.status !== "CLOSED") return null;
  return {
    ok: true,
    action: DIRECT_AUTH_ACTIONS.logout,
    mode: "DIRECT_STAFF_SESSION",
    sessionId,
    status: "CLOSED",
  };
}
