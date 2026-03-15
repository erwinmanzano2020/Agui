"use server";

import { getCurrentEntity } from "@/lib/auth/entity";
import { rotateCardToken, loadCardById } from "@/lib/passes/cards";
import { generatePseudoQrMatrix } from "@/lib/passes/qr";
import { getSupabase } from "@/lib/supabase";

import { INITIAL_MEMBER_PASS_STATE, type MemberPassState } from "./state";

function coerceString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function rotateMemberPassToken(
  _prevState: MemberPassState,
  formData: FormData,
): Promise<MemberPassState> {
  try {
    const cardId = coerceString(formData.get("card_id"));
    if (!cardId) {
      return {
        ...INITIAL_MEMBER_PASS_STATE,
        status: "error",
        message: "We couldn’t find your pass information.",
      };
    }

    let supabase;
    try {
      supabase = getSupabase();
    } catch (error) {
      console.error("Supabase client is unavailable while rotating a member pass", error);
      supabase = null;
    }

    if (!supabase) {
      return {
        ...INITIAL_MEMBER_PASS_STATE,
        status: "error",
        message: "Token rotation requires an active Supabase connection.",
      };
    }

    const entity = await getCurrentEntity({ supabase });
    if (!entity) {
      return {
        ...INITIAL_MEMBER_PASS_STATE,
        status: "error",
        message: "Sign in to rotate your Member Pass token.",
      };
    }

    const card = await loadCardById(cardId, { supabase });
    if (!card || card.entity_id !== entity.id) {
      return {
        ...INITIAL_MEMBER_PASS_STATE,
        status: "error",
        message: "We couldn’t verify access to that pass.",
      };
    }

    const result = await rotateCardToken(card.id, "qr", { supabase });
    const matrix = generatePseudoQrMatrix(result.token);

    return {
      status: "success",
      token: result.token,
      matrix,
      message: null,
    } satisfies MemberPassState;
  } catch (error) {
    console.error("Failed to rotate member pass token", error);
    return {
      ...INITIAL_MEMBER_PASS_STATE,
      status: "error",
      message: "We couldn’t refresh your token right now.",
    };
  }
}
