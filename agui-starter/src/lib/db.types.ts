// src/lib/db.types.ts
// NOTE: Hand-maintained subset. Replace with CLI-generated types when available.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppInboxRow = {
  id: string;
  entity_id: string;
  kind: string;
  title: string;
  body: string | null;
  ref: Json | null;
  created_at: string;
  read_at: string | null;
};

export type AppRow = {
  key: string;
  name: string;
  category: string | null;
  tags: string[];
  default_settings: Json;
  created_at: string;
  updated_at: string;
};

export type TileAssignmentRow = {
  id: string;
  entity_id: string;
  app_key: string;
  context: Json | null;
  visible: boolean;
  created_at: string;
};

export type AppVisibilityRuleRow = {
  app_key: string;
  min_role: "customer" | "employee" | "owner" | "gm" | null;
  require_policies: string[];
  created_at: string;
};

export type AppInboxInsert = {
  id?: string;
  entity_id: string;
  kind: string;
  title: string;
  body?: string | null;
  ref?: Json | null;
  created_at?: string;
  read_at?: string | null;
};

export type AppInboxUpdate = {
  id?: string;
  entity_id?: string;
  kind?: string;
  title?: string;
  body?: string | null;
  ref?: Json | null;
  created_at?: string;
  read_at?: string | null;
};

export type IdentityEntityRow = {
  id: string;
  kind: "person" | "business" | "gm";
  primary_identifier: string | null;
  profile: Json | null;
  created_at: string;
};

export type IdentityEntityInsert = {
  id?: string;
  kind: IdentityEntityRow["kind"];
  primary_identifier?: string | null;
  profile?: Json | null;
  created_at?: string;
};

export type IdentityEntityUpdate = Partial<IdentityEntityInsert>;

export type IdentifierRow = {
  id: string;
  entity_id: string;
  kind: "phone" | "email" | "qr" | "gov_id";
  value: string;
  verified_at: string | null;
};

export type IdentifierInsert = {
  id?: string;
  entity_id: string;
  kind: IdentifierRow["kind"];
  value: string;
  verified_at?: string | null;
};

export type IdentifierUpdate = Partial<IdentifierInsert>;

export type EntitlementRow = {
  entity_id: string;
  code: string;
  source: string | null;
  granted_at: string;
};

export type EntitlementInsert = {
  entity_id: string;
  code: string;
  source?: string | null;
  granted_at?: string;
};

export type EntitlementUpdate = Partial<EntitlementInsert>;

export type EntityIdentifierRow = {
  id: string;
  entity_id: string;
  identifier_type: "EMAIL" | "PHONE" | string | null;
  identifier_value: string | null;
  issuer: string | null;
  value_norm: string;
  is_primary?: boolean | null;
  fingerprint: string;
  value_hash?: string | null;
  meta: Json | null;
  verified_at: string | null;
  added_by_entity_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EntityIdentifierInsert = {
  id?: string;
  entity_id: string;
  identifier_type?: EntityIdentifierRow["identifier_type"];
  identifier_value?: string | null;
  issuer?: string | null;
  value_norm: string;
  is_primary?: boolean | null;
  value_hash?: string | null;
  meta?: Json | null;
  verified_at?: string | null;
  added_by_entity_id?: string | null;
  fingerprint?: string;
  created_at?: string;
  updated_at?: string | null;
};

export type EntityIdentifierUpdate = Partial<EntityIdentifierInsert>;

export type EntityApplicationRow = {
  id: string;
  applicant_entity_id: string;
  kind: string;
  payload: Json | null;
  status: "pending" | "approved" | "rejected";
  decided_by_entity_id: string | null;
  decided_at: string | null;
  processed_at: string | null;
  created_at: string;
  target_brand_id: string | null;
};

export type EntityApplicationInsert = {
  id?: string;
  applicant_entity_id: string;
  kind: string;
  payload?: Json | null;
  status?: EntityApplicationRow["status"];
  decided_by_entity_id?: string | null;
  decided_at?: string | null;
  processed_at?: string | null;
  created_at?: string;
  target_brand_id?: string | null;
};

export type EntityApplicationUpdate = Partial<EntityApplicationInsert>;

export type BrandMembershipRow = {
  id: string;
  entity_id: string;
  brand_id: string;
  created_at: string;
};

export type BrandMembershipInsert = {
  id?: string;
  entity_id: string;
  brand_id: string;
  created_at?: string;
};

export type BrandMembershipUpdate = Partial<BrandMembershipInsert>;

export type EmployeeRow = {
  id: string;
  house_id: string;
  code: string;
  entity_id: string | null;
  full_name: string;
  rate_per_day: number;
  status: "active" | "inactive";
  branch_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EmployeeInsert = {
  id?: string;
  house_id: string;
  code?: string;
  entity_id?: string | null;
  full_name?: string;
  rate_per_day?: number;
  status?: EmployeeRow["status"];
  branch_id?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type EmployeeUpdate = Partial<EmployeeInsert>;

export type DtrSegmentRow = {
  id: string;
  house_id: string;
  employee_id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  overtime_minutes: number;
  source: "manual" | "bulk" | "pos" | "system";
  status: "open" | "closed" | "corrected";
  created_at: string;
};

export type DtrSegmentInsert = {
  id?: string;
  house_id?: string;
  employee_id: string;
  work_date: string;
  time_in?: string | null;
  time_out?: string | null;
  hours_worked?: number | null;
  overtime_minutes?: number;
  source?: DtrSegmentRow["source"];
  status?: DtrSegmentRow["status"];
  created_at?: string;
};

export type DtrSegmentUpdate = Partial<DtrSegmentInsert>;

export type HrScheduleTemplateRow = {
  id: string;
  house_id: string;
  name: string;
  timezone: string;
  created_at: string;
};

export type HrScheduleTemplateInsert = {
  id?: string;
  house_id: string;
  name: string;
  timezone?: string;
  created_at?: string;
};

export type HrScheduleTemplateUpdate = Partial<HrScheduleTemplateInsert>;

export type HrScheduleWindowRow = {
  id: string;
  house_id: string;
  schedule_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  created_at: string;
};

export type HrScheduleWindowInsert = {
  id?: string;
  house_id: string;
  schedule_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  created_at?: string;
};

export type HrScheduleWindowUpdate = Partial<HrScheduleWindowInsert>;

export type HrBranchScheduleAssignmentRow = {
  id: string;
  house_id: string;
  branch_id: string;
  schedule_id: string;
  effective_from: string;
  created_at: string;
};

export type HrBranchScheduleAssignmentInsert = {
  id?: string;
  house_id: string;
  branch_id: string;
  schedule_id: string;
  effective_from: string;
  created_at?: string;
};

export type HrBranchScheduleAssignmentUpdate = Partial<HrBranchScheduleAssignmentInsert>;

export type HrOvertimePolicyRow = {
  house_id: string;
  timezone: string;
  ot_mode: string;
  min_ot_minutes: number;
  rounding_minutes: number;
  rounding_mode: string;
  created_at: string;
};

export type HrOvertimePolicyInsert = {
  house_id: string;
  timezone?: string;
  ot_mode?: string;
  min_ot_minutes?: number;
  rounding_minutes?: number;
  rounding_mode?: string;
  created_at?: string;
};

export type HrOvertimePolicyUpdate = Partial<HrOvertimePolicyInsert>;

export type HrPayrollRunRow = {
  id: string;
  house_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "finalized" | "cancelled";
  created_by: string | null;
  created_at: string;
  finalized_at: string | null;
  finalized_by: string | null;
  finalize_note: string | null;
};

export type HrPayrollRunInsert = {
  id?: string;
  house_id: string;
  period_start: string;
  period_end: string;
  status?: HrPayrollRunRow["status"];
  created_by?: string | null;
  created_at?: string;
  finalized_at?: string | null;
  finalized_by?: string | null;
  finalize_note?: string | null;
};

export type HrPayrollRunUpdate = Partial<HrPayrollRunInsert>;

export type HrPayrollRunItemRow = {
  id: string;
  run_id: string;
  house_id: string;
  employee_id: string;
  work_minutes: number;
  overtime_minutes_raw: number;
  overtime_minutes_rounded: number;
  missing_schedule_days: number;
  open_segment_days: number;
  corrected_segment_days: number;
  notes: Json;
  created_at: string;
};

export type HrPayrollRunItemInsert = {
  id?: string;
  run_id: string;
  house_id: string;
  employee_id: string;
  work_minutes?: number;
  overtime_minutes_raw?: number;
  overtime_minutes_rounded?: number;
  missing_schedule_days?: number;
  open_segment_days?: number;
  corrected_segment_days?: number;
  notes?: Json;
  created_at?: string;
};

export type HrPayrollRunItemUpdate = Partial<HrPayrollRunItemInsert>;

export type BrandOwnerRow = {
  id: string;
  entity_id: string;
  brand_id: string;
  created_at: string;
};

export type BrandOwnerInsert = {
  id?: string;
  entity_id: string;
  brand_id: string;
  created_at?: string;
};

export type BrandOwnerUpdate = Partial<BrandOwnerInsert>;

export type ProfileRow = {
  id: string;
  is_gm: boolean | null;
};

export type ProfileInsert = {
  id: string;
  is_gm?: boolean | null;
};

export type ProfileUpdate = Partial<ProfileInsert>;

export type EntityRow = {
  id: string;
  display_name: string | null;
  profile: Json | null;
  is_gm: boolean | null;
  created_at: string;
  updated_at: string | null;
};

export type EntityInsert = {
  id?: string;
  display_name?: string | null;
  profile?: Json | null;
  is_gm?: boolean | null;
  created_at?: string;
  updated_at?: string | null;
};

export type EntityUpdate = Partial<EntityInsert>;

export type GuildRow = {
  id: string;
  slug: string;
  name: string;
  guild_type: string;
  created_at: string;
  updated_at: string | null;
};

export type GuildInsert = {
  id?: string;
  slug: string;
  name: string;
  guild_type: string;
  created_at?: string;
  updated_at?: string | null;
};

export type GuildUpdate = Partial<GuildInsert>;

export type HouseRow = {
  id: string;
  guild_id: string | null;
  slug: string;
  name: string;
  house_type: string | null;
  created_at: string;
  logo_url?: string | null;
  tagline?: string | null;
};

export type HouseInsert = {
  id?: string;
  guild_id?: string | null;
  slug: string;
  name: string;
  house_type?: string | null;
  created_at?: string;
  logo_url?: string | null;
  tagline?: string | null;
};

export type HouseUpdate = Partial<HouseInsert>;

export type GuildRoleRow = {
  id: string;
  guild_id: string;
  entity_id: string;
  role: string;
  created_at: string;
};

export type GuildRoleInsert = {
  id?: string;
  guild_id: string;
  entity_id: string;
  role: string;
  created_at?: string;
};

export type GuildRoleUpdate = Partial<GuildRoleInsert>;

export type ItemRow = {
  id: string;
  house_id: string | null;
  slug: string | null;
  name: string;
  short_name: string | null;
  brand: string | null;
  category: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  is_sellable: boolean;
  is_raw_material: boolean;
  is_repacked: boolean;
  is_bundle: boolean;
  allow_in_pos: boolean;
  global_item_id: string | null;
  track_inventory: boolean;
  meta: Json;
  created_at: string;
  updated_at: string | null;
};

export type ItemInsert = {
  id?: string;
  house_id?: string | null;
  slug?: string | null;
  name: string;
  short_name?: string | null;
  brand?: string | null;
  category?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  is_sellable?: boolean;
  is_raw_material?: boolean;
  is_repacked?: boolean;
  is_bundle?: boolean;
  allow_in_pos?: boolean;
  global_item_id?: string | null;
  track_inventory?: boolean;
  meta?: Json;
  created_at?: string;
  updated_at?: string | null;
};

export type ItemUpdate = Partial<ItemInsert>;

export type ItemUomRow = {
  id: string;
  house_id: string;
  item_id: string;
  code: string;
  name: string | null;
  is_base: boolean;
  factor_to_base: number;
  variant_label: string | null;
  allow_branch_override: boolean;
  created_at: string;
  updated_at: string | null;
};

export type ItemUomInsert = {
  id?: string;
  house_id: string;
  item_id: string;
  code: string;
  name?: string | null;
  is_base?: boolean;
  factor_to_base?: number;
  variant_label?: string | null;
  allow_branch_override?: boolean;
  created_at?: string;
  updated_at?: string | null;
};

export type ItemUomUpdate = Partial<ItemUomInsert>;

export type ItemBarcodeRow = {
  id: string;
  house_id: string;
  item_id: string;
  uom_id: string | null;
  barcode: string;
  is_primary: boolean;
  created_at: string;
};

export type ItemBarcodeInsert = {
  id?: string;
  house_id: string;
  item_id: string;
  uom_id?: string | null;
  barcode: string;
  is_primary?: boolean;
  created_at?: string;
};

export type ItemBarcodeUpdate = Partial<ItemBarcodeInsert>;

export type ItemPriceRow = {
  id: string;
  house_id: string;
  item_id: string;
  uom_id: string | null;
  unit_price: number;
  currency: string;
  price_type: string;
  tier_tag: string | null;
  cost_cents: number | null;
  markup_percent: number | null;
  suggested_price_cents: number | null;
  metadata: Json;
  created_at: string;
  updated_at: string | null;
};

export type ItemPriceInsert = {
  id?: string;
  house_id: string;
  item_id: string;
  uom_id?: string | null;
  unit_price: number;
  currency?: string;
  price_type?: string;
  tier_tag?: string | null;
  cost_cents?: number | null;
  markup_percent?: number | null;
  suggested_price_cents?: number | null;
  metadata?: Json;
  created_at?: string;
  updated_at?: string | null;
};

export type ItemPriceUpdate = Partial<ItemPriceInsert>;

export type ItemPriceTierRow = {
  id: string;
  house_id: string;
  item_price_id: string;
  min_quantity: number;
  unit_price: number;
  created_at: string;
};

export type ItemPriceTierInsert = {
  id?: string;
  house_id: string;
  item_price_id: string;
  min_quantity?: number;
  unit_price: number;
  created_at?: string;
};

export type ItemPriceTierUpdate = Partial<ItemPriceTierInsert>;

export type GlobalItemRow = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  size: string | null;
  default_uom: string | null;
  default_category: string | null;
  default_shortname: string | null;
  created_at: string;
};

export type GlobalItemInsert = {
  id?: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  size?: string | null;
  default_uom?: string | null;
  default_category?: string | null;
  default_shortname?: string | null;
  created_at?: string;
};

export type GlobalItemUpdate = Partial<GlobalItemInsert>;

export type ItemCostHistoryRow = {
  id: string;
  house_id: string;
  item_id: string;
  uom_id: string | null;
  cost_cents: number;
  currency: string;
  note: string | null;
  meta: Json;
  created_at: string;
};

export type ItemCostHistoryInsert = {
  id?: string;
  house_id: string;
  item_id: string;
  uom_id?: string | null;
  cost_cents: number;
  currency?: string;
  note?: string | null;
  meta?: Json;
  created_at?: string;
};

export type ItemCostHistoryUpdate = Partial<ItemCostHistoryInsert>;

export type ItemBundleRow = {
  id: string;
  house_id: string;
  bundle_parent_id: string;
  child_item_id: string;
  child_uom_id: string | null;
  quantity: number;
  cost_strategy: string;
  created_at: string;
};

export type ItemBundleInsert = {
  id?: string;
  house_id: string;
  bundle_parent_id: string;
  child_item_id: string;
  child_uom_id?: string | null;
  quantity?: number;
  cost_strategy?: string;
  created_at?: string;
};

export type ItemBundleUpdate = Partial<ItemBundleInsert>;

export type ItemRawInputRow = {
  id: string;
  house_id: string;
  finished_item_id: string;
  raw_item_id: string;
  input_uom_id: string | null;
  output_uom_id: string | null;
  quantity: number;
  expected_yield: number | null;
  created_at: string;
};

export type ItemRawInputInsert = {
  id?: string;
  house_id: string;
  finished_item_id: string;
  raw_item_id: string;
  input_uom_id?: string | null;
  output_uom_id?: string | null;
  quantity?: number;
  expected_yield?: number | null;
  created_at?: string;
};

export type ItemRawInputUpdate = Partial<ItemRawInputInsert>;

export type HouseItemRow = {
  id: string;
  house_id: string;
  item_id: string;
  sku: string | null;
  price_cents: number | null;
  price_currency: string;
  stock_quantity: number;
  created_at: string;
  updated_at: string | null;
};

export type HouseItemInsert = {
  id?: string;
  house_id: string;
  item_id: string;
  sku?: string | null;
  price_cents?: number | null;
  price_currency?: string;
  stock_quantity?: number;
  created_at?: string;
  updated_at?: string | null;
};

export type HouseItemUpdate = Partial<HouseItemInsert>;

export type CustomerGroupRow = {
  id: string;
  house_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type CustomerGroupInsert = {
  id?: string;
  house_id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
};

export type CustomerGroupUpdate = Partial<CustomerGroupInsert>;

export type CustomerRow = {
  id: string;
  house_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  entity_id: string | null;
  customer_group_id: string | null;
  meta: Json | null;
  created_at: string;
  updated_at: string | null;
};

export type CustomerInsert = {
  id?: string;
  house_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  entity_id?: string | null;
  customer_group_id?: string | null;
  meta?: Json | null;
  created_at?: string;
  updated_at?: string | null;
};

export type CustomerUpdate = Partial<CustomerInsert>;

export type CustomerGroupPriceRow = {
  id: string;
  house_id: string;
  customer_group_id: string;
  item_price_id: string;
  min_quantity: number;
  unit_price: number;
  created_at: string;
};

export type CustomerGroupPriceInsert = {
  id?: string;
  house_id: string;
  customer_group_id: string;
  item_price_id: string;
  min_quantity?: number;
  unit_price: number;
  created_at?: string;
};

export type CustomerGroupPriceUpdate = Partial<CustomerGroupPriceInsert>;

export type CustomerPriceRuleRow = {
  id: string;
  house_id: string;
  item_id: string | null;
  uom_id: string | null;
  customer_id: string | null;
  customer_group_id: string | null;
  rule_type: "PERCENT_DISCOUNT" | "FIXED_PRICE";
  percent_off: number | null;
  fixed_price_cents: number | null;
  applies_to_category_id: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CustomerPriceRuleInsert = {
  id?: string;
  house_id: string;
  item_id?: string | null;
  uom_id?: string | null;
  customer_id?: string | null;
  customer_group_id?: string | null;
  rule_type: CustomerPriceRuleRow["rule_type"];
  percent_off?: number | null;
  fixed_price_cents?: number | null;
  applies_to_category_id?: string | null;
  is_active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type CustomerPriceRuleUpdate = Partial<CustomerPriceRuleInsert>;

export type HouseRoleRow = {
  id: string;
  house_id: string;
  entity_id: string;
  role: string;
  created_at: string;
};

export type HouseRoleInsert = {
  id?: string;
  house_id: string;
  entity_id: string;
  role: string;
  created_at?: string;
};

export type HouseRoleUpdate = Partial<HouseRoleInsert>;

export type SettingsCatalogRow = {
  key: string;
  type: string;
  description: string;
  category: string;
  meta: Json;
  default_value: Json;
  created_at: string;
};

export type SettingsCatalogInsert = {
  key: string;
  type: string;
  description: string;
  category: string;
  meta?: Json;
  default_value: Json;
  created_at?: string;
};

export type SettingsCatalogUpdate = Partial<SettingsCatalogInsert>;

export type SettingsValueRow = {
  id: string;
  key: string;
  scope: "GM" | "BUSINESS" | "BRANCH";
  business_id: string | null;
  branch_id: string | null;
  value: Json;
  version: number;
  updated_by: string | null;
  updated_at: string | null;
};

export type SettingsValueInsert = {
  id?: string;
  key: string;
  scope: "GM" | "BUSINESS" | "BRANCH";
  business_id?: string | null;
  branch_id?: string | null;
  value: Json;
  version?: number;
  updated_by?: string | null;
  updated_at?: string | null;
};

export type SettingsValueUpdate = Partial<SettingsValueInsert>;

export type SettingsAuditRow = {
  id: string;
  key: string;
  scope: "GM" | "BUSINESS" | "BRANCH";
  business_id: string | null;
  branch_id: string | null;
  old_value: Json | null;
  new_value: Json | null;
  changed_by: string | null;
  changed_at: string;
};

export type SettingsAuditInsert = {
  id?: string;
  key: string;
  scope: "GM" | "BUSINESS" | "BRANCH";
  business_id?: string | null;
  branch_id?: string | null;
  old_value?: Json | null;
  new_value?: Json | null;
  changed_by?: string | null;
  changed_at?: string;
};

export type SettingsAuditUpdate = Partial<SettingsAuditInsert>;

export type PolicyRow = {
  id: string;
  key: string;
  action: string;
  resource: string;
  description: string | null;
  is_system: boolean;
  is_assignable: boolean;
  created_at: string;
};

export type PolicyInsert = {
  id?: string;
  key: string;
  action: string;
  resource: string;
  description?: string | null;
  is_system?: boolean;
  is_assignable?: boolean;
  created_at?: string;
};

export type PolicyUpdate = Partial<PolicyInsert>;

export type RoleScope = "PLATFORM" | "GUILD" | "HOUSE";

export type RoleRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  scope: RoleScope;
  scope_ref: string | null;
  owner_entity_id: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type RoleInsert = {
  id?: string;
  slug: string;
  label: string;
  description?: string | null;
  scope: RoleScope;
  scope_ref?: string | null;
  owner_entity_id?: string | null;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RoleUpdate = Partial<RoleInsert>;

export type RolePolicyRow = {
  role_id: string;
  policy_id: string;
  created_at: string;
};

export type RolePolicyInsert = {
  role_id?: string | null;
  policy_id: string;
  created_at?: string;
};

export type RolePolicyUpdate = Partial<RolePolicyInsert>;

export type PlatformRolesRow = {
  entity_id: string;
  roles: string[];
  created_at: string;
  updated_at: string;
};

export type PlatformRolesInsert = {
  entity_id: string;
  roles?: string[];
  created_at?: string;
  updated_at?: string;
};

export type PlatformRolesUpdate = Partial<PlatformRolesInsert>;

export type EntityPolicyGrantRow = {
  entity_id: string;
  policy_id: string;
  granted_via: string;
  created_at: string;
};

export type EntityPolicyGrantInsert = {
  entity_id: string;
  policy_id: string;
  granted_via?: string;
  created_at?: string;
};

export type EntityPolicyGrantUpdate = Partial<EntityPolicyGrantInsert>;

export type LoyaltyMembershipViewRow = {
  user_id: string;
  brand_id: string;
  brand_slug: string;
  brand_name: string;
};

export type EmployeeRosterViewRow = {
  user_id: string;
  brand_id: string;
  brand_slug: string;
  brand_name: string;
  role: string | null;
};

export type BrandOwnerViewRow = {
  user_id: string;
  brand_id: string;
  brand_slug: string;
  brand_name: string;
};

export type PosSaleRow = {
  id: string;
  house_id: string;
  workspace_id: string | null;
  sequence_no: number | null;
  receipt_number: string | null;
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  amount_received_cents: number;
  change_cents: number;
  outstanding_cents: number;
  customer_entity_id: string | null;
  customer_name: string | null;
  customer_ref: string | null;
  meta: Json | null;
  created_at: string;
  created_by: string | null;
  closed_at: string | null;
  shift_id: string | null;
};

export type PosSaleInsert = {
  id?: string;
  house_id: string;
  workspace_id?: string | null;
  sequence_no?: number | null;
  receipt_number?: string | null;
  status?: string;
  subtotal_cents: number;
  discount_cents?: number;
  total_cents: number;
  amount_received_cents: number;
  change_cents: number;
  outstanding_cents: number;
  customer_entity_id?: string | null;
  customer_name?: string | null;
  customer_ref?: string | null;
  meta?: Json | null;
  created_at?: string;
  created_by?: string | null;
  closed_at?: string | null;
  shift_id?: string | null;
};

export type PosSaleUpdate = Partial<PosSaleInsert>;

export type PosSaleLineRow = {
  id: string;
  sale_id: string;
  house_id: string;
  item_id: string;
  uom_id: string | null;
  barcode: string | null;
  name_snapshot: string;
  uom_label_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  tier_applied: string | null;
  meta: Json | null;
  created_at: string;
  updated_at: string | null;
};

export type PosSaleLineInsert = {
  id?: string;
  sale_id: string;
  house_id: string;
  item_id: string;
  uom_id?: string | null;
  barcode?: string | null;
  name_snapshot: string;
  uom_label_snapshot?: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  tier_applied?: string | null;
  meta?: Json | null;
  created_at?: string;
  updated_at?: string | null;
};

export type PosSaleLineUpdate = Partial<PosSaleLineInsert>;

export type PosSaleTenderRow = {
  id: string;
  sale_id: string;
  house_id: string;
  tender_type: string;
  amount_cents: number;
  reference: string | null;
  meta: Json | null;
  created_at: string;
  updated_at: string | null;
};

export type PosSaleTenderInsert = {
  id?: string;
  sale_id: string;
  house_id: string;
  tender_type: string;
  amount_cents: number;
  reference?: string | null;
  meta?: Json | null;
  created_at?: string;
  updated_at?: string | null;
};

export type PosSaleTenderUpdate = Partial<PosSaleTenderInsert>;

export type PosShiftRow = {
  id: string;
  house_id: string;
  branch_id: string;
  cashier_entity_id: string;
  opened_by_entity_id: string;
  closed_by_entity_id: string | null;
  opened_at: string;
  closed_at: string | null;
  verified_at: string | null;
  opening_float_json: Json;
  opening_cash_cents: number;
  expected_cash_cents: number;
  counted_cash_cents: number;
  cash_over_short_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
  meta: Json;
};

export type PosShiftInsert = {
  id?: string;
  house_id: string;
  branch_id: string;
  cashier_entity_id?: string;
  opened_by_entity_id?: string;
  closed_by_entity_id?: string | null;
  opened_at?: string;
  closed_at?: string | null;
  verified_at?: string | null;
  opening_float_json?: Json;
  opening_cash_cents?: number;
  expected_cash_cents?: number;
  counted_cash_cents?: number;
  cash_over_short_cents?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  meta?: Json;
};

export type PosShiftUpdate = Partial<PosShiftInsert>;

export type StockMovementRow = {
  id: string;
  house_id: string;
  branch_id: string | null;
  item_id: string;
  uom_id: string | null;
  quantity_delta: number;
  movement_type: string;
  sale_id: string | null;
  sale_line_id: string | null;
  is_overdrawn: boolean;
  created_at: string;
};

export type StockMovementInsert = {
  id?: string;
  house_id: string;
  branch_id?: string | null;
  item_id: string;
  uom_id?: string | null;
  quantity_delta: number;
  movement_type: string;
  sale_id?: string | null;
  sale_line_id?: string | null;
  is_overdrawn?: boolean;
  created_at?: string;
};

export type StockMovementUpdate = Partial<StockMovementInsert>;

type TableDefinition<RowType, InsertType, UpdateType> = {
  Row: RowType;
  Insert: InsertType;
  Update: UpdateType;
  Relationships: [];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type GenericTableDefinition = TableDefinition<any, any, any>;
type GenericViewDefinition = ViewDefinition<any>;
type GenericFunctionDefinition = FunctionDefinition<any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

type ViewDefinition<RowType> = {
  Row: RowType;
  Relationships: [];
};

type FunctionDefinition<ArgsType, ReturnType> = {
  Args: ArgsType;
  Returns: ReturnType;
};

export interface IdentityDatabase {
  public: {
    Tables: {
      entities: TableDefinition<IdentityEntityRow, IdentityEntityInsert, IdentityEntityUpdate>;
      identifiers: TableDefinition<IdentifierRow, IdentifierInsert, IdentifierUpdate>;
      entitlements: TableDefinition<EntitlementRow, EntitlementInsert, EntitlementUpdate>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export interface Database {
  public: {
    Tables: Record<string, GenericTableDefinition> & {
      app_inbox: TableDefinition<AppInboxRow, AppInboxInsert, AppInboxUpdate>;
      entity_identifiers: TableDefinition<
        EntityIdentifierRow,
        EntityIdentifierInsert,
        EntityIdentifierUpdate
      >;
      entity_applications: TableDefinition<
        EntityApplicationRow,
        EntityApplicationInsert,
        EntityApplicationUpdate
      >;
      brand_memberships: TableDefinition<
        BrandMembershipRow,
        BrandMembershipInsert,
        BrandMembershipUpdate
      >;
      entitlements: TableDefinition<
        EntitlementRow,
        EntitlementInsert,
        EntitlementUpdate
      >;
      employees: TableDefinition<EmployeeRow, EmployeeInsert, EmployeeUpdate>;
      dtr_segments: TableDefinition<DtrSegmentRow, DtrSegmentInsert, DtrSegmentUpdate>;
      hr_schedule_templates: TableDefinition<
        HrScheduleTemplateRow,
        HrScheduleTemplateInsert,
        HrScheduleTemplateUpdate
      >;
      hr_schedule_windows: TableDefinition<
        HrScheduleWindowRow,
        HrScheduleWindowInsert,
        HrScheduleWindowUpdate
      >;
      hr_branch_schedule_assignments: TableDefinition<
        HrBranchScheduleAssignmentRow,
        HrBranchScheduleAssignmentInsert,
        HrBranchScheduleAssignmentUpdate
      >;
      hr_overtime_policies: TableDefinition<
        HrOvertimePolicyRow,
        HrOvertimePolicyInsert,
        HrOvertimePolicyUpdate
      >;
      hr_payroll_runs: TableDefinition<
        HrPayrollRunRow,
        HrPayrollRunInsert,
        HrPayrollRunUpdate
      >;
      hr_payroll_run_items: TableDefinition<
        HrPayrollRunItemRow,
        HrPayrollRunItemInsert,
        HrPayrollRunItemUpdate
      >;
      brand_owners: TableDefinition<BrandOwnerRow, BrandOwnerInsert, BrandOwnerUpdate>;
      profiles: TableDefinition<ProfileRow, ProfileInsert, ProfileUpdate>;
      entities: TableDefinition<EntityRow, EntityInsert, EntityUpdate>;
      guilds: TableDefinition<GuildRow, GuildInsert, GuildUpdate>;
      guild_roles: TableDefinition<GuildRoleRow, GuildRoleInsert, GuildRoleUpdate>;
      global_items: TableDefinition<GlobalItemRow, GlobalItemInsert, GlobalItemUpdate>;
      items: TableDefinition<ItemRow, ItemInsert, ItemUpdate>;
      item_uoms: TableDefinition<ItemUomRow, ItemUomInsert, ItemUomUpdate>;
      item_barcodes: TableDefinition<ItemBarcodeRow, ItemBarcodeInsert, ItemBarcodeUpdate>;
      item_prices: TableDefinition<ItemPriceRow, ItemPriceInsert, ItemPriceUpdate>;
      item_price_tiers: TableDefinition<
        ItemPriceTierRow,
        ItemPriceTierInsert,
        ItemPriceTierUpdate
      >;
      item_cost_history: TableDefinition<
        ItemCostHistoryRow,
        ItemCostHistoryInsert,
        ItemCostHistoryUpdate
      >;
      item_bundles: TableDefinition<ItemBundleRow, ItemBundleInsert, ItemBundleUpdate>;
      item_raw_inputs: TableDefinition<ItemRawInputRow, ItemRawInputInsert, ItemRawInputUpdate>;
      houses: TableDefinition<HouseRow, HouseInsert, HouseUpdate>;
      house_items: TableDefinition<HouseItemRow, HouseItemInsert, HouseItemUpdate>;
      house_roles: TableDefinition<HouseRoleRow, HouseRoleInsert, HouseRoleUpdate>;
      customer_groups: TableDefinition<
        CustomerGroupRow,
        CustomerGroupInsert,
        CustomerGroupUpdate
      >;
      customers: TableDefinition<CustomerRow, CustomerInsert, CustomerUpdate>;
      customer_group_prices: TableDefinition<
        CustomerGroupPriceRow,
        CustomerGroupPriceInsert,
        CustomerGroupPriceUpdate
      >;
      customer_price_rules: TableDefinition<
        CustomerPriceRuleRow,
        CustomerPriceRuleInsert,
        CustomerPriceRuleUpdate
      >;
      platform_roles: TableDefinition<PlatformRolesRow, PlatformRolesInsert, PlatformRolesUpdate>;
      policies: TableDefinition<PolicyRow, PolicyInsert, PolicyUpdate>;
      roles: TableDefinition<RoleRow, RoleInsert, RoleUpdate>;
      role_policies: TableDefinition<RolePolicyRow, RolePolicyInsert, RolePolicyUpdate>;
      entity_policy_grants: TableDefinition<
        EntityPolicyGrantRow,
        EntityPolicyGrantInsert,
        EntityPolicyGrantUpdate
      >;
      settings_catalog: TableDefinition<
        SettingsCatalogRow,
        SettingsCatalogInsert,
        SettingsCatalogUpdate
      >;
      settings_values: TableDefinition<
        SettingsValueRow,
        SettingsValueInsert,
        SettingsValueUpdate
      >;
      settings_audit: TableDefinition<
        SettingsAuditRow,
        SettingsAuditInsert,
        SettingsAuditUpdate
      >;
      pos_shifts: TableDefinition<PosShiftRow, PosShiftInsert, PosShiftUpdate>;
      pos_sales: TableDefinition<PosSaleRow, PosSaleInsert, PosSaleUpdate>;
      pos_sale_lines: TableDefinition<PosSaleLineRow, PosSaleLineInsert, PosSaleLineUpdate>;
      pos_sale_tenders: TableDefinition<PosSaleTenderRow, PosSaleTenderInsert, PosSaleTenderUpdate>;
      stock_movements: TableDefinition<StockMovementRow, StockMovementInsert, StockMovementUpdate>;
    };
    Views: Record<string, GenericViewDefinition> & {
      v_loyalty_memberships: ViewDefinition<LoyaltyMembershipViewRow>;
      v_employee_roster: ViewDefinition<EmployeeRosterViewRow>;
      v_brand_owners: ViewDefinition<BrandOwnerViewRow>;
    };
    Functions: Record<string, GenericFunctionDefinition> & {
      process_application: FunctionDefinition<
        { p_application_id: string; p_decider_entity_id: string },
        void
      >;
      current_entity_id: FunctionDefinition<Record<string, never>, string | null>;
    };
  };
}
