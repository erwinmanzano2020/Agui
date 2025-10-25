import { NextResponse } from "next/server";
import type { Session } from "@supabase/supabase-js";

import {
  buildSupabaseAuthCookie,
  buildSupabaseSignOutCookie,
  getSupabaseAuthCookieName,
} from "@/lib/supabase-auth-cookie";

function okResponse(body: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...body });
}

function unauthorizedResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function POST(request: Request) {
  const cookieName = getSupabaseAuthCookieName();
  if (!cookieName) {
    return okResponse({ skipped: true });
  }

  let payload: { event?: string; session?: Session | null };
  try {
    payload = (await request.json()) as { event?: string; session?: Session | null };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const session = payload.session;
  if (!session) {
    return unauthorizedResponse("Missing session");
  }

  const response = okResponse();
  const cookie = buildSupabaseAuthCookie(session);
  response.cookies.set(cookie.name, cookie.value, {
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    maxAge: cookie.maxAge,
  });

  return response;
}

export async function DELETE() {
  const cookie = buildSupabaseSignOutCookie();
  if (!cookie) {
    return okResponse({ skipped: true });
  }

  const response = okResponse();
  response.cookies.set(cookie.name, cookie.value, {
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    maxAge: cookie.maxAge,
  });

  return response;
}
