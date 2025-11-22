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
  kind:
    | "email"
    | "phone"
    | "qr"
    | "gov_id"
    | "loyalty_card"
    | "employee_no"
    | "other";
  issuer: string | null;
  value_norm: string;
  fingerprint: string;
  meta: Json | null;
  verified_at: string | null;
  added_by_entity_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EntityIdentifierInsert = {
  id?: string;
  entity_id: string;
  kind: EntityIdentifierRow["kind"];
  issuer?: string | null;
  value_norm: string;
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
  entity_id: string;
  brand_id: string;
  code: string | null;
  full_name: string | null;
  status: string | null;
  rate_per_day: number | null;
  created_at: string;
  updated_at: string | null;
};

export type EmployeeInsert = {
  id?: string;
  entity_id: string;
  brand_id: string;
  code?: string | null;
  full_name?: string | null;
  status?: string | null;
  rate_per_day?: number | null;
  created_at?: string;
  updated_at?: string | null;
};

export type EmployeeUpdate = Partial<EmployeeInsert>;

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
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ItemInsert = {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type ItemUpdate = Partial<ItemInsert>;

export type ItemBarcodeRow = {
  id: string;
  item_id: string;
  barcode: string;
  is_primary: boolean | null;
  created_at: string;
};

export type ItemBarcodeInsert = {
  id?: string;
  item_id: string;
  barcode: string;
  is_primary?: boolean | null;
  created_at?: string;
};

export type ItemBarcodeUpdate = Partial<ItemBarcodeInsert>;

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
      brand_owners: TableDefinition<BrandOwnerRow, BrandOwnerInsert, BrandOwnerUpdate>;
      profiles: TableDefinition<ProfileRow, ProfileInsert, ProfileUpdate>;
      entities: TableDefinition<EntityRow, EntityInsert, EntityUpdate>;
      guilds: TableDefinition<GuildRow, GuildInsert, GuildUpdate>;
      guild_roles: TableDefinition<GuildRoleRow, GuildRoleInsert, GuildRoleUpdate>;
      items: TableDefinition<ItemRow, ItemInsert, ItemUpdate>;
      item_barcodes: TableDefinition<ItemBarcodeRow, ItemBarcodeInsert, ItemBarcodeUpdate>;
      houses: TableDefinition<HouseRow, HouseInsert, HouseUpdate>;
      house_items: TableDefinition<HouseItemRow, HouseItemInsert, HouseItemUpdate>;
      house_roles: TableDefinition<HouseRoleRow, HouseRoleInsert, HouseRoleUpdate>;
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
