import type { SettingScope, SettingType } from "./types";

type SettingTypeValueMap = {
  string: string;
  boolean: boolean;
  number: number;
  json: Record<string, unknown>;
};

export type SettingDefinition<
  TType extends SettingType = SettingType,
  TValue = SettingTypeValueMap[TType],
> = {
  key: string;
  type: TType;
  description: string;
  category: string;
  meta: Record<string, unknown>;
  defaultValue: TValue;
};

export const SETTINGS_CATALOG = [
  {
    key: "receipt.show_total_savings",
    type: "boolean",
    description: "Display total customer savings on receipts",
    category: "receipt",
    meta: {},
    defaultValue: true,
  },
  {
    key: "receipt.footer_text",
    type: "string",
    description: "Footer text printed on customer receipts",
    category: "receipt",
    meta: {},
    defaultValue: "Thank you for shopping!",
  },
  {
    key: "receipt.print_profile",
    type: "string",
    description: "Printer profile used for receipts",
    category: "receipt",
    meta: { options: ["thermal80", "a4"] },
    defaultValue: "thermal80",
  },
  {
    key: "pos.theme.primary_color",
    type: "string",
    description: "Primary brand color for POS interface",
    category: "pos",
    meta: {},
    defaultValue: "#004aad",
  },
  {
    key: "pos.theme.dark_mode",
    type: "boolean",
    description: "Enable dark mode theme for POS",
    category: "pos",
    meta: {},
    defaultValue: false,
  },
  {
    key: "pos.float_template",
    type: "json",
    description: "Default float denominations for POS opening",
    category: "pos",
    meta: {},
    defaultValue: {
      "1000": 0,
      "500": 0,
      "100": 0,
      "50": 0,
      "20": 0,
      "10": 0,
      "5": 0,
      "1": 0,
    },
  },
  {
    key: "labels.discount.loyalty",
    type: "string",
    description: "Label for loyalty discounts",
    category: "labels",
    meta: {},
    defaultValue: "Loyalty",
  },
  {
    key: "labels.discount.wholesale",
    type: "string",
    description: "Label for wholesale discounts",
    category: "labels",
    meta: {},
    defaultValue: "Wholesale",
  },
  {
    key: "labels.discount.manual",
    type: "string",
    description: "Label for manual discounts",
    category: "labels",
    meta: {},
    defaultValue: "Manual",
  },
  {
    key: "labels.discount.promo",
    type: "string",
    description: "Label for promotional discounts",
    category: "labels",
    meta: {},
    defaultValue: "Promo",
  },
  {
    key: "sop.cashier_variance_thresholds",
    type: "json",
    description: "Variance thresholds for cashier variance SOP",
    category: "sop",
    meta: {
      schema: {
        small: "number",
        medium: "number",
        large: "number",
      },
    },
    defaultValue: {
      small: 100,
      medium: 250,
      large: 500,
    },
  },
] as const satisfies readonly SettingDefinition[];

type CatalogEntry = (typeof SETTINGS_CATALOG)[number];

export type SettingKey = CatalogEntry["key"];
export type SettingCategory = CatalogEntry["category"];

export type SettingValueByType<T extends SettingType> = SettingTypeValueMap[T];

export type SettingValueForKey<K extends SettingKey> = SettingValueByType<
  Extract<CatalogEntry, { key: K }> extends { type: infer T extends SettingType }
    ? T
    : never
>;

export type CatalogEntriesForCategory<C extends SettingCategory> = Extract<
  CatalogEntry,
  { category: C }
>;

export type SettingsSnapshotForCategory<C extends SettingCategory> = {
  [E in CatalogEntriesForCategory<C> as E["key"]]: SettingValueByType<E["type"]>;
};

export type SettingDefinitionForKey<K extends SettingKey> = Extract<
  CatalogEntry,
  { key: K }
>;

export const SETTINGS_BY_KEY: Record<SettingKey, CatalogEntry> = SETTINGS_CATALOG.reduce(
  (acc, entry) => {
    acc[entry.key] = entry;
    return acc;
  },
  {} as Record<SettingKey, CatalogEntry>
);

export function assertSettingKey(key: string): asserts key is SettingKey {
  if (!(key in SETTINGS_BY_KEY)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
}

type ScopeOrder = readonly SettingScope[];
export const SETTING_SCOPE_ORDER: ScopeOrder = ["BRANCH", "BUSINESS", "GM"];
