import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { getServiceSupabase } from "@/lib/supabase-service";

export type EmploymentStatus = "pending" | "active" | "suspended" | "ended";

export type EmploymentRecord = {
  id: string;
  business_id: string;
  entity_id: string;
  role_id: string | null;
  status: EmploymentStatus;
  created_at: string;
};

export type HouseRoleRecord = {
  id: string;
  house_id: string;
  entity_id: string;
  role: string;
  granted_at: string;
  granted_by: string | null;
  metadata: Record<string, unknown>;
};

export type OnboardEmployeeResult = {
  employment: EmploymentRecord | null;
  houseRole: HouseRoleRecord | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEmploymentRecord(value: unknown): value is EmploymentRecord {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<EmploymentRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.business_id === "string" &&
    typeof candidate.entity_id === "string" &&
    (candidate.role_id === null || typeof candidate.role_id === "string") &&
    typeof candidate.status === "string" &&
    ["pending", "active", "suspended", "ended"].includes(candidate.status) &&
    typeof candidate.created_at === "string"
  );
}

function isHouseRoleRecord(value: unknown): value is HouseRoleRecord {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<HouseRoleRecord>;
  const metadata = candidate.metadata;

  const metadataIsObject =
    metadata === null ||
    metadata === undefined ||
    (typeof metadata === "object" && metadata !== null);

  return (
    typeof candidate.id === "string" &&
    typeof candidate.house_id === "string" &&
    typeof candidate.entity_id === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.granted_at === "string" &&
    (candidate.granted_by === null || typeof candidate.granted_by === "string") &&
    metadataIsObject
  );
}

export function parseOnboardEmployeeResult(payload: unknown): OnboardEmployeeResult {
  if (!isObject(payload)) {
    return { employment: null, houseRole: null };
  }

  const container = payload as {
    employment?: unknown;
    house_role?: unknown;
  };

  const employment = isEmploymentRecord(container.employment)
    ? container.employment
    : null;

  const houseRole = isHouseRoleRecord(container.house_role)
    ? (container.house_role as HouseRoleRecord)
    : null;

  return { employment, houseRole };
}

export async function listAccountUserIds(entityId: string): Promise<string[]> {
  const svc = getServiceSupabase();
  const { data, error } = await svc.from("accounts").select("user_id").eq("entity_id", entityId);
  if (error) {
    throw new Error((error as PostgrestError).message);
  }

  const result: string[] = [];
  for (const row of data ?? []) {
    const userId = (row as { user_id?: string | null }).user_id;
    if (typeof userId === "string" && userId) {
      result.push(userId);
    }
  }

  return result;
}
