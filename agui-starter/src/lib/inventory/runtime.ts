// Inventory adoption helpers that avoid schema execution at module scope.

const ALLOWED_SOURCES = ["demo-seed", "csv", "manual"] as const;

export const INVENTORY_SOURCES = ALLOWED_SOURCES;

export type AdoptInventoryInput = {
  source: (typeof ALLOWED_SOURCES)[number];
  dryRun?: boolean;
};

export type AdoptInventoryResult = {
  ok: true;
  adopted: {
    source: AdoptInventoryInput["source"];
    dryRun: boolean;
  };
};

export async function adoptInventory(input: AdoptInventoryInput): Promise<AdoptInventoryResult> {
  return {
    ok: true,
    adopted: {
      source: input.source,
      dryRun: Boolean(input.dryRun),
    },
  };
}

export function allowedSources() {
  return [...ALLOWED_SOURCES];
}
