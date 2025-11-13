"use server";

import { revalidateTag } from "next/cache";

import { getMyEntityId } from "@/lib/authz/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type EventKind = "invalidate" | "info";

type EventPayload = Record<string, unknown> | null | undefined;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function emitEvent(topic: string, kind: EventKind = "info", payload: EventPayload = {}): Promise<void> {
  if (!isNonEmptyString(topic)) {
    throw new Error("Event topic is required");
  }

  const supabase = await createServerSupabaseClient();
  const entityId = await getMyEntityId(supabase).catch(() => null);

  const { error } = await supabase.rpc("emit_event", {
    p_topic: topic,
    p_kind: kind,
    p_payload: payload ?? {},
    p_created_by: entityId,
  });

  if (error) {
    console.warn("emit_event RPC failed", error);
  }

  try {
    revalidateTag(topic);
  } catch (error) {
    console.warn("Failed to revalidate topic tag", { topic, error });
  }

  if (topic.startsWith("tiles:user:")) {
    const parts = topic.split(":");
    const userId = parts.length >= 3 ? parts[2] : null;
    if (isNonEmptyString(userId)) {
      try {
        revalidateTag(`tiles:user:${userId}`);
      } catch (error) {
        console.warn("Failed to revalidate tiles tag", { topic, error });
      }
    }
  }

  if (topic.startsWith("settings:")) {
    try {
      revalidateTag("settings:*");
    } catch (error) {
      console.warn("Failed to revalidate settings wildcard tag", { topic, error });
    }
  }
}

export async function emitEvents(topics: string[], kind: EventKind = "info", payload: EventPayload = {}): Promise<void> {
  if (!Array.isArray(topics) || topics.length === 0) {
    return;
  }

  for (const topic of topics) {
    await emitEvent(topic, kind, payload);
  }
}
