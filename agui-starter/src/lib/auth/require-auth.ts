import { redirect } from "next/navigation";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RequireAuthResult = {
  supabase: SupabaseClient;
  user: User;
  session: Session;
};

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
    redirect(buildRedirectLocation(nextPath));
  }

  try {
    const cookieStore = await Promise.resolve(cookies());
    const cookieNames = cookieStore.getAll().map((c) => c.name);
    const hasSbToken = cookieNames.some((name) => /^sb-[a-zA-Z0-9]+-auth-token$/.test(name));
    const hasLegacy = cookieNames.some((name) => ["sb-access-token", "sb:token", "supabase-auth-token"].includes(name));
    console.debug("[requireAuth] cookie check", { hasSbToken, hasLegacy, cookieCount: cookieNames.length });
  } catch (logError) {
    console.warn("[requireAuth] failed to inspect cookies", logError);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn("[requireAuth] auth.getUser failed or missing user", {
      error: userError?.message ?? null,
      code: userError?.code ?? null,
    });
    redirect(buildRedirectLocation(nextPath));
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) {
    redirect(buildRedirectLocation(nextPath));
  }

  return {
    supabase,
    user,
    session: sessionData.session,
  } satisfies RequireAuthResult;
}
