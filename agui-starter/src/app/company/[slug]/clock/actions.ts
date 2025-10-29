"use server";

import { getCurrentEntity } from "@/lib/auth/entity";
import { recordScanEvent, resolveScanByToken, resolveScanByTokenId, type ScanResolution } from "@/lib/passes/scan";
import { getSupabase } from "@/lib/supabase";
import { loadHouseBySlug } from "@/lib/taxonomy/houses-server";
import { z } from "@/lib/z";
import { stringEnum } from "@/lib/schema-helpers";
import {
  INITIAL_CLOCK_SCAN_STATE,
  type ClockScanEvent,
  type ClockScanResolution,
  type ClockScanState,
} from "./state";

if (process.env.NODE_ENV !== "production" && typeof z?.string !== "function") {
  throw new Error(
    "Zod import for /company/[slug]/clock/actions.ts is misconfigured. Use `import { z } from \"zod\"`.",
  );
}

const MODE_VALUES = ["resolve", "reset", "override-lower", "lift-incognito"] as const;
const ModeSchema = stringEnum(MODE_VALUES);
type ClockMode = (typeof MODE_VALUES)[number];
const DEFAULT_MODE: ClockMode = "resolve";

function coerceString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toClockResolution(
  scan: ScanResolution,
  overrides: { incognitoActive?: boolean; incognitoReason?: string | null } = {},
): ClockScanResolution {
  return {
    tokenId: scan.token.id,
    tokenKind: scan.token.kind,
    tokenExpiresAt: scan.token.expiresAt,
    cardId: scan.card.id,
    cardNo: scan.card.cardNo,
    cardStatus: scan.card.status,
    schemeId: scan.card.scheme.id,
    schemeName: scan.card.scheme.name,
    schemeScope: scan.card.scheme.scope,
    schemePrecedence: scan.card.scheme.precedence,
    schemeAllowIncognito: scan.card.scheme.allowIncognito,
    entityId: scan.entity.id,
    entityName: scan.entity.displayName,
    incognitoDefault: scan.incognitoDefault,
    incognitoActive: overrides.incognitoActive ?? scan.incognitoActive,
    incognitoOverrideReason: overrides.incognitoReason ?? null,
    higherCard: scan.higherCard,
    linkedCards: scan.linkedCards,
    loyaltyAccount: scan.loyaltyAccount,
    guildRoles: scan.guildRoles,
    houseRoles: scan.houseRoles,
  } satisfies ClockScanResolution;
}

function buildEvent(reason: string, liftedIncognito: boolean): ClockScanEvent {
  return {
    reason,
    liftedIncognito,
    recordedAt: new Date().toISOString(),
  } satisfies ClockScanEvent;
}

export async function handleClockScan(
  prevState: ClockScanState,
  formData: FormData,
): Promise<ClockScanState> {
  try {
    const modeResult = ModeSchema.safeParse(
      coerceString(formData.get("mode")) ?? DEFAULT_MODE,
    );
    if (!modeResult.success) {
      const { formErrors } = modeResult.error.flatten();
      return {
        status: "error",
        message: formErrors[0] ?? "Invalid clock action.",
        resolution: prevState.resolution,
        event: prevState.event,
      } satisfies ClockScanState;
    }
    const mode = modeResult.data;
    if (mode === "reset") {
      return INITIAL_CLOCK_SCAN_STATE;
    }

    const slug = coerceString(formData.get("slug"));
    if (!slug) {
      return {
        status: "error",
        message: "Missing company context. Reload and try again.",
        resolution: prevState.resolution,
        event: prevState.event,
      } satisfies ClockScanState;
    }

    let supabase;
    try {
      supabase = getSupabase();
    } catch (error) {
      console.error("Supabase is not configured while resolving scans", error);
      supabase = null;
    }

    if (!supabase) {
      return {
        status: "error",
        message: "Scanning requires an active Supabase connection.",
        resolution: null,
        event: null,
      } satisfies ClockScanState;
    }

    const house = await loadHouseBySlug(supabase, slug);
    if (!house) {
      return {
        status: "error",
        message: "We couldn’t find that company. Confirm the URL and try again.",
        resolution: null,
        event: null,
      } satisfies ClockScanState;
    }

    const context = { supabase, houseId: house.id, guildId: house.guild_id } as const;

    if (mode === "resolve") {
      const token = coerceString(formData.get("token"));
      if (!token) {
        return {
          status: "error",
          message: "Scan a token before resolving.",
          resolution: null,
          event: null,
        } satisfies ClockScanState;
      }

      const scan = await resolveScanByToken(token, context);
      const resolution = toClockResolution(scan);
      if (scan.higherCard) {
        return {
          status: "needs-override",
          message: `Higher-precedence card detected (${scan.higherCard.schemeName}). Request that credential or log an override.`,
          resolution,
          event: null,
        } satisfies ClockScanState;
      }

      return {
        status: "resolved",
        message: `${scan.card.scheme.name} ready for ${scan.entity.displayName}.`,
        resolution,
        event: null,
      } satisfies ClockScanState;
    }

    const tokenId = coerceString(formData.get("token_id"));
    if (!tokenId) {
      return {
        status: "error",
        message: "That scan expired. Ask to rescan the pass.",
        resolution: null,
        event: null,
      } satisfies ClockScanState;
    }

    const scan = await resolveScanByTokenId(tokenId, context);
    const cardId = coerceString(formData.get("card_id"));
    if (!cardId || cardId !== scan.card.id) {
      return {
        status: "error",
        message: "Card mismatch detected. Request a fresh scan.",
        resolution: null,
        event: null,
      } satisfies ClockScanState;
    }

    const actor = await getCurrentEntity({ supabase }).catch((error) => {
      console.warn("Failed to resolve current entity while logging scan", error);
      return null;
    });

    if (!actor) {
      return {
        status: "error",
        message: "Sign in to record scan overrides.",
        resolution: toClockResolution(scan),
        event: prevState.event,
      } satisfies ClockScanState;
    }

    const reason = coerceString(formData.get("reason"));
    if (!reason) {
      return {
        status: mode === "lift-incognito" ? "resolved" : "needs-override",
        message: "Share a reason before continuing.",
        resolution: toClockResolution(scan),
        event: prevState.event,
      } satisfies ClockScanState;
    }

    if (mode === "override-lower") {
      await recordScanEvent({
        ...context,
        tokenId: scan.token.id,
        cardId: scan.card.id,
        actorId: actor.id,
        liftedIncognito: false,
        reason,
      });

      return {
        status: "resolved",
        message: "Override logged. Proceed with the lower-precedence card.",
        resolution: toClockResolution(scan),
        event: buildEvent(reason, false),
      } satisfies ClockScanState;
    }

    if (mode === "lift-incognito") {
      await recordScanEvent({
        ...context,
        tokenId: scan.token.id,
        cardId: scan.card.id,
        actorId: actor.id,
        liftedIncognito: true,
        reason,
      });

      return {
        status: "resolved",
        message: "Incognito lifted for this scan.",
        resolution: toClockResolution(scan, { incognitoActive: false, incognitoReason: reason }),
        event: buildEvent(reason, true),
      } satisfies ClockScanState;
    }

    return {
      status: "error",
      message: "Unsupported scan action.",
      resolution: prevState.resolution,
      event: prevState.event,
    } satisfies ClockScanState;
  } catch (error) {
    console.error("Failed to handle scan action", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "We couldn’t resolve that scan.",
      resolution: null,
      event: null,
    } satisfies ClockScanState;
  }
}
