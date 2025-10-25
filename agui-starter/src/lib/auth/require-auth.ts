import { redirect } from "next/navigation";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export type RequireAuthResult = {
  supabase: SupabaseClient;
  user: User;
  session: Session;
};

function buildRedirectLocation(nextPath: string): string {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/signin";
  }

  const params = new URLSearchParams({ next: nextPath });
  return `/signin?${params.toString()}`;
}

export async function requireAuth(nextPath: string): Promise<RequireAuthResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(buildRedirectLocation(nextPath));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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
