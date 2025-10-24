"use server";

import { loadUiTerms, saveUiTerms, type UiTerms } from "@/lib/ui-terms";

export async function getTerms(): Promise<UiTerms> {
  return loadUiTerms();
}

export async function updateTerms(formData: FormData) {
  const payload: Partial<UiTerms> = {
    alliance: formData.get("alliance")?.toString() ?? undefined,
    guild: formData.get("guild")?.toString() ?? undefined,
    company: formData.get("company")?.toString() ?? undefined,
    team: formData.get("team")?.toString() ?? undefined,
    alliance_pass: formData.get("alliance_pass")?.toString() ?? undefined,
    guild_card: formData.get("guild_card")?.toString() ?? undefined,
    house_pass: formData.get("house_pass")?.toString() ?? undefined,
  };
  await saveUiTerms(payload);
}
