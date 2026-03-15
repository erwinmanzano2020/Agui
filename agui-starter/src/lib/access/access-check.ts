import "server-only";

import type { FeatureInput } from "@/lib/auth/permissions";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { requireAuth } from "@/lib/auth/require-auth";
import { evaluatePolicy } from "@/lib/policy/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireHrAccess } from "@/lib/hr/access";

import type { AccessContext, ResolveAccessContextInput } from "./access-resolver";
import { resolveAccessContext } from "./access-resolver";

export async function requireAuthentication(
  input: ResolveAccessContextInput,
  options?: { nextPath?: string },
): Promise<AccessContext> {
  const nextPath = options?.nextPath ?? "/";
  const auth = await requireAuth(nextPath);

  return resolveAccessContext({
    ...input,
    userId: auth.user.id,
  });
}

export function requireMembership(context: AccessContext): AccessContext {
  if (context.elevatedAuthority.hasOperationalElevatedAuthority) {
    return context;
  }

  if (context.membership.isMember) {
    return context;
  }

  throw new Error(
    `Membership required for scope ${context.scopeType}${context.scopeId ? `:${context.scopeId}` : ""}`,
  );
}

export async function requireModuleAccess(
  feature: FeatureInput,
  context: AccessContext,
  options?: { dest?: string },
): Promise<AccessContext> {
  await requireFeatureAccess(feature, options);
  return context;
}

function isHrAction(action: string, resource: string): boolean {
  const source = `${action}:${resource}`.toLowerCase();
  return source.includes("hr") || source.includes("payroll") || source.includes("employee");
}

export async function requireActionPermission(
  action: string,
  resource: string,
  context: AccessContext,
): Promise<AccessContext> {
  if (context.scopeType === "house" && context.scopeId && isHrAction(action, resource)) {
    const supabase = await createServerSupabaseClient();
    const hrDecision = await requireHrAccess(supabase, context.scopeId);
    if (!hrDecision.allowed) {
      throw new Error(`HR access denied for house scope ${context.scopeId}`);
    }

    return context;
  }

  const allowed = await evaluatePolicy({ action, resource });
  if (!allowed) {
    throw new Error(`Action permission denied for ${action}:${resource}`);
  }

  return context;
}
