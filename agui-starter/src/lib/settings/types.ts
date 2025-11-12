export type SettingScope = "GM" | "BUSINESS" | "BRANCH";
export type SettingType = "string" | "boolean" | "number" | "json";

export type SettingSource = SettingScope;

export interface SettingIdentifier {
  businessId?: string | null;
  branchId?: string | null;
}

export interface SettingScopeDescriptor extends SettingIdentifier {
  scope: SettingScope;
}

export interface EffectiveSettingResult<TValue> {
  value: TValue;
  source: SettingSource;
}

export interface SettingsSnapshotOptions extends SettingIdentifier {
  category: string;
}

export interface SettingsMutationTarget extends SettingIdentifier {
  key: string;
  scope: SettingScope;
}

export interface SetSettingInput<TValue> extends SettingsMutationTarget {
  value: TValue;
}

export type ResetSettingInput = SettingsMutationTarget;

export type AuditLogRecord<TValue> = {
  key: string;
  scope: SettingScope;
  business_id: string | null;
  branch_id: string | null;
  old_value: TValue | null;
  new_value: TValue | null;
  changed_by: string | null;
  changed_at: string;
};

export type SettingsSnapshotRecord<TValue> = {
  value: TValue;
  source: SettingSource;
};
