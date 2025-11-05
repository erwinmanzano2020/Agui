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

export type AppInboxUpdate = Pick<AppInboxInsert, "read_at">;

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
  role: string;
  created_at: string;
};

export type EmployeeInsert = {
  id?: string;
  entity_id: string;
  brand_id: string;
  role: string;
  created_at?: string;
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

type GenericTable = {
  Row: any;
  Insert: any;
  Update: any;
  Relationships: any[];
};

type AppInboxTable = {
  Row: AppInboxRow;
  Insert: AppInboxInsert;
  Update: AppInboxUpdate;
  Relationships: [];
};

type EntityIdentifierTable = {
  Row: EntityIdentifierRow;
  Insert: EntityIdentifierInsert;
  Update: EntityIdentifierUpdate;
  Relationships: [];
};

type EntityApplicationTable = {
  Row: EntityApplicationRow;
  Insert: EntityApplicationInsert;
  Update: EntityApplicationUpdate;
  Relationships: [];
};

type BrandMembershipTable = {
  Row: BrandMembershipRow;
  Insert: BrandMembershipInsert;
  Update: BrandMembershipUpdate;
  Relationships: [];
};

type EmployeeTable = {
  Row: EmployeeRow;
  Insert: EmployeeInsert;
  Update: EmployeeUpdate;
  Relationships: [];
};

type BrandOwnerTable = {
  Row: BrandOwnerRow;
  Insert: BrandOwnerInsert;
  Update: BrandOwnerUpdate;
  Relationships: [];
};

interface PublicTables {
  accounts: GenericTable;
  alliance_guilds: GenericTable;
  alliance_roles: GenericTable;
  alliances: GenericTable;
  app_inbox: AppInboxTable;
  applications: GenericTable;
  brand_memberships: BrandMembershipTable;
  brand_owners: BrandOwnerTable;
  card_tokens: GenericTable;
  cards: GenericTable;
  clock_events: GenericTable;
  demo_seed_runs: GenericTable;
  dtr_entries: GenericTable;
  dtr_segments: GenericTable;
  dtr_with_rates: GenericTable;
  employee_memberships: GenericTable;
  employee_rate_history: GenericTable;
  employee_shift_overrides: GenericTable;
  employee_shift_weekly: GenericTable;
  employees: EmployeeTable;
  entities: GenericTable;
  entity_applications: EntityApplicationTable;
  entity_identifiers: EntityIdentifierTable;
  guild_roles: GenericTable;
  guilds: GenericTable;
  house_items: GenericTable;
  house_roles: GenericTable;
  houses: GenericTable;
  invites: GenericTable;
  item_barcodes: GenericTable;
  items: GenericTable;
  loyalty_memberships: GenericTable;
  loyalty_profiles: GenericTable;
  loyalty_schemes: GenericTable;
  orgs_as_guilds: GenericTable;
  owner_memberships: GenericTable;
  parties: GenericTable;
  payroll_deductions: GenericTable;
  platform_roles: GenericTable;
  profiles: GenericTable;
  sale_finalize_keys: GenericTable;
  sale_holds: GenericTable;
  sale_lines: GenericTable;
  sale_payments: GenericTable;
  sales: GenericTable;
  scan_events: GenericTable;
  settings_payroll: GenericTable;
  shifts: GenericTable;
  tenant_theme: GenericTable;
  ui_terms: GenericTable;
  user_quest_daily: GenericTable;
}

interface PublicViews extends Record<string, { Row: Record<string, unknown> }> {
  v_loyalty_memberships: { Row: any };
  v_employee_roster: { Row: any };
  v_brand_owners: { Row: any };
}

interface PublicFunctions
  extends Record<string, { Args: Record<string, unknown>; Returns: unknown }> {
  process_application: {
    Args: { p_application_id: string; p_decider_entity_id: string };
    Returns: void;
  };
  current_entity_id: { Args: Record<string, never>; Returns: string | null };
}

export interface Database {
  public: {
    Tables: PublicTables;
    Views: PublicViews;
    Functions: PublicFunctions;
    Enums: Record<string, unknown>;
  };
}
