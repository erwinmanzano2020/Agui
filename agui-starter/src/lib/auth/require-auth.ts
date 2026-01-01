import { redirect } from "next/navigation";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RequireAuthResult = {
  supabase: SupabaseClient;
  user: User;
  session: Session;
};

function logAuthEvent(
  level: "info" | "warn",
  message: string,
  details: Record<string, unknown>,
): void {
  const payload = {
    ...details,
    userId: typeof details.userId === "string" ? details.userId : undefined,
    next: typeof details.next === "string" ? details.next : undefined,
  };
  console[level](`[auth] ${message}`, payload);
}

function buildRedirectLocation(nextPath: string): string {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/welcome";
  }

  const params = new URLSearchParams({ next: nextPath });
  return `/welcome?${params.toString()}`;
}

export async function requireAuth(nextPath: string): Promise<RequireAuthResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    logAuthEvent("warn", "supabase client unavailable", { next: nextPath });
    redirect(buildRedirectLocation(nextPath));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logAuthEvent("warn", "auth.getUser missing user", {
      next: nextPath,
      code: userError?.code ?? null,
      message: userError?.message ?? null,
    });
    redirect(buildRedirectLocation(nextPath));
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) {
    logAuthEvent("warn", "auth.getSession missing session", {
      next: nextPath,
      userId: user.id,
      code: sessionError?.code ?? null,
      message: sessionError?.message ?? null,
    });
    redirect(buildRedirectLocation(nextPath));
  }

  logAuthEvent("info", "session restored", { next: nextPath, userId: user.id });

  return {
    supabase,
    user,
    session: sessionData.session,
  } satisfies RequireAuthResult;
}
