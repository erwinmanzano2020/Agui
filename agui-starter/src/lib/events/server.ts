"use server";

import { revalidateTag } from "./revalidate.ts";

type CreateServerSupabaseClient = typeof import("../supabase/server.ts")["createServerSupabaseClient"];
type GetMyEntityId = typeof import("../authz/server.ts")["getMyEntityId"];

type EventKind = "invalidate" | "info";

type EventPayload = Record<string, unknown> | null | undefined;

type EmitEventOptions = { skipRevalidate?: boolean };

function isMissingEventInfra(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "PGRST202" || code === "PGRST204";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

let createServerSupabaseClient: CreateServerSupabaseClient = async (...args) => {
  const mod = await import("../supabase/server.ts");
  return mod.createServerSupabaseClient(...args);
};

let getMyEntityId: GetMyEntityId = async (...args) => {
  const mod = await import("../authz/server.ts");
  return mod.getMyEntityId(...args);
};

type EventDeps = {
  createClient?: CreateServerSupabaseClient;
  getEntityId?: GetMyEntityId;
};

export function __setEventDeps({ createClient, getEntityId }: EventDeps): void {
  if (createClient) {
    createServerSupabaseClient = createClient;
  }
  if (getEntityId) {
    getMyEntityId = getEntityId;
  }
}

export function __resetEventDeps(): void {
  createServerSupabaseClient = async (...args) => {
    const mod = await import("../supabase/server.ts");
    return mod.createServerSupabaseClient(...args);
  };
  getMyEntityId = async (...args) => {
    const mod = await import("../authz/server.ts");
    return mod.getMyEntityId(...args);
  };
}

export async function emitEvent(
  topic: string,
  kind: EventKind = "info",
  payload: EventPayload = {},
  options: EmitEventOptions = {},
): Promise<void> {
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
    if (isMissingEventInfra(error)) {
      console.warn("emit_event RPC missing", error);
      return;
    }
    console.warn("emit_event RPC failed", error);
    return;
  }

  if (!options.skipRevalidate) {
    try {
      revalidateTag(topic);
    } catch (error) {
      console.warn("Failed to revalidate topic tag", { topic, error });
    }
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
