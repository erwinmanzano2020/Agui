"use server";

import { headers } from "next/headers";

import {
  resetSettingToParent,
  setSetting,
} from "@/lib/settings/server";
import { SETTINGS_BY_KEY, type SettingKey, type SettingValueForKey } from "@/lib/settings/catalog";
import type { SettingScope } from "@/lib/settings/types";
import { parseRoleFromHeaders } from "@/app/api/settings/_auth";

type SaveSettingPayload<K extends SettingKey> = {
  key: K;
  scope: SettingScope;
  value: SettingValueForKey<K>;
  businessId?: string;
  branchId?: string;
};

type ResetSettingPayload<K extends SettingKey> = {
  key: K;
  scope: SettingScope;
  businessId?: string;
  branchId?: string;
};

async function assertAuthorization(scope: SettingScope, businessId?: string, branchId?: string) {
  const headerStore = await headers();
  const role = parseRoleFromHeaders(headerStore);
  if (!role) {
    throw new Error("Unauthorized");
  }

  if (scope === "GM" && role.role !== "GM") {
    throw new Error("Only GM may perform this operation");
  }

  if (scope === "BUSINESS") {
    if (!businessId) {
      throw new Error("businessId required for BUSINESS scope");
    }
    if (role.role === "BUSINESS_ADMIN" && role.businessId !== businessId) {
      throw new Error("Business mismatch");
    }
    if (role.role === "BRANCH_MANAGER" && role.businessId !== businessId) {
      throw new Error("Business mismatch");
    }
  }

  if (scope === "BRANCH") {
    if (!businessId || !branchId) {
      throw new Error("branchId and businessId required for BRANCH scope");
    }
    if (role.role === "BUSINESS_ADMIN" && role.businessId !== businessId) {
      throw new Error("Business mismatch");
    }
    if (role.role === "BRANCH_MANAGER") {
      if (role.businessId !== businessId || role.branchId !== branchId) {
        throw new Error("Branch mismatch");
      }
    }
  }
}

export async function saveSettingAction<K extends SettingKey>(payload: SaveSettingPayload<K>) {
  await assertAuthorization(payload.scope, payload.businessId, payload.branchId);
  const definition = SETTINGS_BY_KEY[payload.key];
  if (!definition) {
    throw new Error(`Unknown setting ${payload.key}`);
  }
  await setSetting(payload, null);
}

export async function resetSettingAction<K extends SettingKey>(payload: ResetSettingPayload<K>) {
  await assertAuthorization(payload.scope, payload.businessId, payload.branchId);
  if (!SETTINGS_BY_KEY[payload.key]) {
    throw new Error(`Unknown setting ${payload.key}`);
  }
  await resetSettingToParent(payload, null);
}
