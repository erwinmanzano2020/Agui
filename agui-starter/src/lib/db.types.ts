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

export type ProfileRow = {
  id: string;
  is_gm: boolean | null;
};

export type ProfileInsert = {
  id: string;
  is_gm?: boolean | null;
};

export type ProfileUpdate = Partial<ProfileInsert>;

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

type GenericTableDefinition = TableDefinition<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

type TableDefinition<RowType, InsertType, UpdateType> = {
  Row: RowType;
  Insert: InsertType;
  Update: UpdateType;
  Relationships: [];
};

type GenericViewDefinition = ViewDefinition<Record<string, unknown>>;

type ViewDefinition<RowType> = {
  Row: RowType;
  Relationships: [];
};

type GenericFunctionDefinition = FunctionDefinition<Record<string, unknown>, unknown>;

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
