"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";

const UNIQUE_VIOLATION = "23505";

type SessionStatus = "initializing" | "ready" | "error";
type EntityStatus = "idle" | "loading" | "ready" | "error";

export type ViewAsScope = "GUILD" | "HOUSE";

export type ViewAsSelection = {
  scope: ViewAsScope;
  guildId?: string | null;
  houseId?: string | null;
  roles: string[];
};

type SessionContextValue = {
  supabase: SupabaseClient | null;
  status: SessionStatus;
  session: Session | null;
  user: User | null;
  entityId: string | null;
  entityStatus: EntityStatus;
  viewAs: ViewAsSelection | null;
  setViewAs: (selection: ViewAsSelection | null) => void;
  clearViewAs: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  const digits = phone.trim().replace(/[^\d+]/g, "");
  if (!digits) {
    return "";
  }

  return digits.startsWith("+") ? digits : `+${digits}`;
}

function resolveDisplayName(user: User, fallback: string): string {
  const meta = user.user_metadata ?? {};
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.displayName,
    user.email,
    user.phone,
    fallback,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallback;
}

type EnsureEntityResult = {
  entityId: string | null;
  error?: Error;
};

async function ensureEntityForUser(
  client: SupabaseClient,
  user: User,
): Promise<EnsureEntityResult> {
  const hasEmail = typeof user.email === "string" && user.email.trim().length > 0;
  const hasPhone = typeof user.phone === "string" && user.phone.trim().length > 0;

  if (!hasEmail && !hasPhone) {
    return { entityId: null };
  }

  const identifierType = hasEmail ? "EMAIL" : "PHONE";
  const rawIdentifier = hasEmail ? user.email! : user.phone!;
  const normalizedIdentifier = hasEmail
    ? normalizeEmail(rawIdentifier)
    : normalizePhone(rawIdentifier);

  if (!normalizedIdentifier) {
    return { entityId: null };
  }

  const { data: existingIdentifier, error: lookupError } = await client
    .from("entity_identifiers")
    .select("entity_id")
    .eq("identifier_type", identifierType)
    .eq("identifier_value", normalizedIdentifier)
    .maybeSingle();

  if (lookupError) {
    return { entityId: null, error: new Error(lookupError.message) };
  }

  if (existingIdentifier?.entity_id) {
    return { entityId: existingIdentifier.entity_id };
  }

  const displayName = resolveDisplayName(user, normalizedIdentifier);
  const profile = {
    auth_user_id: user.id,
    user_metadata: user.user_metadata ?? {},
    app_metadata: user.app_metadata ?? {},
  };

  const { data: createdEntity, error: createEntityError } = await client
    .from("entities")
    .insert({ display_name: displayName, profile })
    .select("id")
    .single();

  if (createEntityError) {
    return { entityId: null, error: new Error(createEntityError.message) };
  }

  const newEntityId = createdEntity.id;
  const { error: identifierError } = await client
    .from("entity_identifiers")
    .insert({
      entity_id: newEntityId,
      identifier_type: identifierType,
      identifier_value: normalizedIdentifier,
      is_primary: true,
    });

  if (identifierError) {
    if (identifierError.code === UNIQUE_VIOLATION) {
      const { data: retry, error: retryError } = await client
        .from("entity_identifiers")
        .select("entity_id")
        .eq("identifier_type", identifierType)
        .eq("identifier_value", normalizedIdentifier)
        .maybeSingle();

      if (retryError) {
        await client.from("entities").delete().eq("id", newEntityId);
        return { entityId: null, error: new Error(retryError.message) };
      }

      if (retry?.entity_id) {
        await client.from("entities").delete().eq("id", newEntityId);
        return { entityId: retry.entity_id };
      }
    }

    await client.from("entities").delete().eq("id", newEntityId);

    return { entityId: null, error: new Error(identifierError.message) };
  }

  return { entityId: newEntityId };
}

type SessionProviderProps = {
  children: ReactNode;
};

const VIEW_AS_STORAGE_KEY = "agui:view-as";

function sanitizeViewAs(selection: ViewAsSelection | null): ViewAsSelection | null {
  if (!selection) return null;
  const roles = Array.isArray(selection.roles)
    ? selection.roles.filter(
        (role): role is string =>
          typeof role === "string" && role.trim().length > 0
      )
    : [];

  if (selection.scope === "GUILD") {
    return {
      scope: "GUILD",
      guildId: selection.guildId ?? null,
      roles,
    } satisfies ViewAsSelection;
  }

  return {
    scope: "HOUSE",
    houseId: selection.houseId ?? null,
    roles,
  } satisfies ViewAsSelection;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [supabase] = useState<SupabaseClient | null>(() => {
    try {
      return getSupabase();
    } catch (error) {
      console.error("Failed to initialize Supabase client", error);
      return null;
    }
  });
  const [status, setStatus] = useState<SessionStatus>(supabase ? "initializing" : "error");
  const [session, setSession] = useState<Session | null>(null);
  const [entityState, setEntityState] = useState<{ id: string | null; status: EntityStatus }>(() => ({
    id: null,
    status: "idle",
  }));
  const [viewAsState, setViewAsState] = useState<ViewAsSelection | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const syncSessionCookie = useCallback(
    async (event: AuthChangeEvent | "INITIAL_SESSION", nextSession: Session | null) => {
      try {
        if (!nextSession || event === "SIGNED_OUT") {
          await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
          return;
        }

        await fetch("/api/auth/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event, session: nextSession }),
        });
      } catch (error) {
        console.warn("Failed to sync Supabase session cookie", error);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(VIEW_AS_STORAGE_KEY);
      if (!raw) {
        setViewAsState(null);
        return;
      }
      const parsed = JSON.parse(raw) as ViewAsSelection;
      setViewAsState(sanitizeViewAs(parsed));
    } catch (error) {
      console.warn("Failed to restore view-as selection", error);
      setViewAsState(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!viewAsState) {
      window.localStorage.removeItem(VIEW_AS_STORAGE_KEY);
      return;
    }
    try {
      window.localStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify(viewAsState));
    } catch (error) {
      console.warn("Failed to persist view-as selection", error);
    }
  }, [viewAsState]);

  useEffect(() => {
    if (!session?.user) {
      setViewAsState(null);
    }
  }, [session?.user]);

  const setViewAs = useCallback((selection: ViewAsSelection | null) => {
    setViewAsState(sanitizeViewAs(selection));
  }, []);

  const clearViewAs = useCallback(() => {
    setViewAsState(null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return;
        }

        if (error) {
          console.error("Failed to resolve Supabase session", error);
          setStatus("error");
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setStatus("ready");

        if (nextSession) {
          void syncSessionCookie("INITIAL_SESSION", nextSession);
        }
      })
      .catch((error) => {
        console.error("Failed to initialize Supabase session", error);
        setStatus("error");
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);

      if (event === "SIGNED_OUT") {
        activeUserIdRef.current = null;
        setEntityState({ id: null, status: "idle" });
      }

      void syncSessionCookie(event, nextSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, syncSessionCookie]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const user = session?.user ?? null;
    if (!user) {
      activeUserIdRef.current = null;
      setEntityState({ id: null, status: "idle" });
      return;
    }

    if (activeUserIdRef.current === user.id && entityState.status === "ready") {
      return;
    }

    let cancelled = false;
    setEntityState((previous) => ({ id: previous.id, status: "loading" }));

    ensureEntityForUser(supabase, user)
      .then(({ entityId, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          console.error("Failed to ensure entity for session", error);
          setEntityState({ id: null, status: "error" });
          return;
        }

        activeUserIdRef.current = user.id;
        setEntityState({ id: entityId ?? null, status: "ready" });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Unexpected error while ensuring entity", error);
          setEntityState({ id: null, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, session, entityState.status]);

  const value = useMemo<SessionContextValue>(() => {
    return {
      supabase,
      status,
      session,
      user: session?.user ?? null,
      entityId: entityState.id,
      entityStatus: entityState.status,
      viewAs: viewAsState,
      setViewAs,
      clearViewAs,
    } satisfies SessionContextValue;
  }, [supabase, status, session, entityState.id, entityState.status, viewAsState, setViewAs, clearViewAs]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}

export type { SessionStatus, EntityStatus, SessionContextValue };
