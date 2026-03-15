import type { Json } from "@/lib/db.types";

export type SettingScope = "GM" | "BUSINESS" | "BRANCH";
export type SettingType = "string" | "boolean" | "number" | "json";

type SettingTypeValue<T extends SettingType> = T extends "boolean"
  ? boolean
  : T extends "number"
    ? number
    : T extends "json"
      ? Json
      : string;

type BaseDefinition<Key extends string, Type extends SettingType> = {
  readonly key: Key;
  readonly type: Type;
  readonly category: SettingCategory;
  readonly description: string;
  readonly meta: Record<string, unknown>;
  readonly defaultValue: SettingTypeValue<Type>;
};

export type SettingCategory =
  | "receipt"
  | "pos"
  | "labels"
  | "sop"
  | "email"
  | "preview"
  | "ui";

const DEFINITIONS = [
  {
    key: "receipt.show_total_savings",
    type: "boolean",
    category: "receipt",
    description: "Show a savings line item on receipts",
    meta: { label: "Show total savings" },
    defaultValue: true,
  },
  {
    key: "receipt.footer_text",
    type: "string",
    category: "receipt",
    description: "Footer copy appended to every receipt",
    meta: { maxLength: 160 },
    defaultValue: "Thank you for shopping!",
  },
  {
    key: "receipt.print_profile",
    type: "string",
    category: "receipt",
    description: "Printer profile for receipt rendering",
    meta: { options: ["thermal80", "a4"], enforced: false },
    defaultValue: "thermal80",
  },
  {
    key: "pos.theme.primary_color",
    type: "string",
    category: "pos",
    description: "Primary accent color for the POS UI",
    meta: { format: "hex" },
    defaultValue: "#2563eb",
  },
  {
    key: "pos.theme.dark_mode",
    type: "boolean",
    category: "pos",
    description: "Enable dark mode surfaces in POS",
    meta: { label: "Dark mode" },
    defaultValue: false,
  },
  {
    key: "pos.float_template",
    type: "json",
    category: "pos",
    description: "Default float denominations",
    meta: { schema: "denom->count" },
    defaultValue: {},
  },
  {
    key: "pos.cash.blind_drop_enabled",
    type: "boolean",
    category: "pos",
    description: "Allow blind end-of-shift submissions",
    meta: { label: "Enable blind drops" },
    defaultValue: true,
  },
  {
    key: "pos.cash.overage_pool.enabled",
    type: "boolean",
    category: "pos",
    description: "Track and use branch overage pool balances",
    meta: { label: "Enable overage pool" },
    defaultValue: true,
  },
  {
    key: "pos.cash.overage_pool.max_offset_ratio",
    type: "number",
    category: "pos",
    description: "Maximum share of pool allowed to cover a shortage",
    meta: { min: 0, max: 1, step: 0.05 },
    defaultValue: 0.5,
  },
  {
    key: "pos.cash.float.defaults",
    type: "json",
    category: "pos",
    description: "Suggested float denominations for shift opening",
    meta: { schema: "denom->count" },
    defaultValue: {},
  },
  {
    key: "labels.house",
    type: "string",
    category: "labels",
    description: "Label for the workspace or house entity",
    meta: { maxLength: 48 },
    defaultValue: "house",
  },
  {
    key: "labels.branch",
    type: "string",
    category: "labels",
    description: "Label for a branch/location",
    meta: { maxLength: 48 },
    defaultValue: "branch",
  },
  {
    key: "labels.pass",
    type: "string",
    category: "labels",
    description: "Label for guest or member passes",
    meta: { maxLength: 48 },
    defaultValue: "pass",
  },
  {
    key: "labels.discount.loyalty",
    type: "string",
    category: "labels",
    description: "Label for loyalty discounts",
    meta: { maxLength: 48 },
    defaultValue: "Loyalty",
  },
  {
    key: "labels.discount.wholesale",
    type: "string",
    category: "labels",
    description: "Label for wholesale discounts",
    meta: { maxLength: 48 },
    defaultValue: "Wholesale",
  },
  {
    key: "labels.discount.manual",
    type: "string",
    category: "labels",
    description: "Label for manual discounts",
    meta: { maxLength: 48 },
    defaultValue: "Manual",
  },
  {
    key: "labels.discount.promo",
    type: "string",
    category: "labels",
    description: "Label for promotional discounts",
    meta: { maxLength: 48 },
    defaultValue: "Promo",
  },
  {
    key: "sop.cashier_variance_thresholds",
    type: "json",
    category: "sop",
    description: "Cashier variance thresholds",
    meta: { schema: "small/medium/large" },
    defaultValue: { small: 5, medium: 15, large: 30 },
  },
  {
    key: "sop.start_shift_hint",
    type: "string",
    category: "sop",
    description: "Guidance shown when opening a shift",
    meta: { maxLength: 240 },
    defaultValue: "Capture the float you received at the beginning of your shift.",
  },
  {
    key: "sop.blind_drop_hint",
    type: "string",
    category: "sop",
    description: "Guidance shown when submitting a blind drop",
    meta: { maxLength: 240 },
    defaultValue: "Enter the denominations you counted at the end of your shift.",
  },
  {
    key: "gm.ui.always_show_start_business_tile",
    type: "boolean",
    category: "ui",
    description: "Always show the Start a business tile for Game Masters",
    meta: { label: "Always show Start a business tile" },
    defaultValue: false,
  },
] as const satisfies ReadonlyArray<BaseDefinition<string, SettingType>>;

export type SettingDefinition = (typeof DEFINITIONS)[number];
export type SettingKey = SettingDefinition["key"];
export type SettingValueMap = {
  [K in SettingKey]: Extract<SettingDefinition, { key: K }> extends infer D
    ? D extends { type: infer T }
      ? T extends SettingType
        ? SettingTypeValue<T>
        : never
      : never
    : never;
};

export function getSettingDefinition<K extends SettingKey>(key: K): Extract<SettingDefinition, { key: K }> {
  const def = DEFINITIONS.find((entry) => entry.key === key);
  if (!def) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  return def as Extract<SettingDefinition, { key: K }>;
}

export function listSettingDefinitions(): SettingDefinition[] {
  return [...DEFINITIONS];
}

export const SETTING_CATEGORIES = Array.from(
  new Set(DEFINITIONS.map((definition) => definition.category)),
) as SettingCategory[];

export function isSettingCategory(value: string | null | undefined): value is SettingCategory {
  return value != null && (SETTING_CATEGORIES as readonly string[]).includes(value);
}

export function listSettingDefinitionsByCategory(category: SettingCategory): SettingDefinition[] {
  return DEFINITIONS.filter((entry) => entry.category === category);
}
