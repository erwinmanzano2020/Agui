import type { SettingKey, SettingScope, SettingValueMap } from "./catalog";

export type SettingSource = SettingScope;

export type SettingSnapshotEntry<K extends SettingKey = SettingKey> = {
  key: K;
  value: SettingValueMap[K];
  source: SettingSource;
};

export type SettingsSnapshot = Partial<Record<SettingKey, SettingSnapshotEntry>>;

export type SettingContext = {
  businessId?: string | null;
  branchId?: string | null;
};

export type SettingWriteInput<K extends SettingKey = SettingKey> = {
  key: K;
  scope: SettingScope;
  value: SettingValueMap[K];
  businessId?: string | null;
  branchId?: string | null;
};
