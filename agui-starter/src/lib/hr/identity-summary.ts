import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

export type HrIdentitySummaryRow = {
  entity_id: string | null;
  identifier_type: string | null;
  masked_value: string | null;
  is_primary: boolean | null;
};

export type HrIdentitySummaryEntry = {
  identifierType: "EMAIL" | "PHONE" | string;
  maskedValue: string;
  isPrimary: boolean;
};

export type HrIdentitySummaryMap = Record<string, HrIdentitySummaryEntry[]>;

export function normalizeIdentitySummary(
  rows: HrIdentitySummaryRow[] | null | undefined,
): HrIdentitySummaryMap {
  const summary: HrIdentitySummaryMap = {};

  for (const row of rows ?? []) {
    if (!row?.entity_id) continue;
    const type = (row.identifier_type ?? "").toUpperCase();
    const entry: HrIdentitySummaryEntry = {
      identifierType: type || "UNKNOWN",
      maskedValue: row.masked_value ?? "***",
      isPrimary: Boolean(row.is_primary),
    };

    if (!summary[row.entity_id]) {
      summary[row.entity_id] = [];
    }
    summary[row.entity_id]?.push(entry);
  }

  for (const value of Object.values(summary)) {
    value.sort((a, b) => {
      if (a.isPrimary === b.isPrimary) {
        return a.identifierType.localeCompare(b.identifierType);
      }
      return a.isPrimary ? -1 : 1;
    });
  }

  return summary;
}

export async function fetchIdentitySummary(
  supabase: SupabaseClient<Database>,
  houseId: string,
  entityIds: string[],
): Promise<HrIdentitySummaryMap> {
  if (entityIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase.rpc("hr_get_entity_identity_summary", {
    p_house_id: houseId,
    p_entity_ids: entityIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeIdentitySummary((data ?? []) as HrIdentitySummaryRow[]);
}
