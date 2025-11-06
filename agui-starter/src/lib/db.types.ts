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
  meta: Json | null;
  verified_at: string | null;
  added_by_entity_id: string;
  created_at: string;
};

export type EntityIdentifierInsert = {
  id?: string;
  entity_id: string;
  kind: EntityIdentifierRow["kind"];
  issuer?: string | null;
  value_norm: string;
  meta?: Json | null;
  verified_at?: string | null;
  added_by_entity_id: string;
  created_at?: string;
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
      employees: TableDefinition<EmployeeRow, EmployeeInsert, EmployeeUpdate>;
      brand_owners: TableDefinition<BrandOwnerRow, BrandOwnerInsert, BrandOwnerUpdate>;
      profiles: TableDefinition<ProfileRow, ProfileInsert, ProfileUpdate>;
      entities: TableDefinition<EntityRow, EntityInsert, EntityUpdate>;
      guilds: TableDefinition<GuildRow, GuildInsert, GuildUpdate>;
      guild_roles: TableDefinition<GuildRoleRow, GuildRoleInsert, GuildRoleUpdate>;
      items: TableDefinition<ItemRow, ItemInsert, ItemUpdate>;
      item_barcodes: TableDefinition<ItemBarcodeRow, ItemBarcodeInsert, ItemBarcodeUpdate>;
      house_items: TableDefinition<HouseItemRow, HouseItemInsert, HouseItemUpdate>;
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
