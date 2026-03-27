import "server-only";

import type { FeatureInput } from "@/lib/auth/permissions";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccess } from "@/lib/hr/access";
import { evaluatePolicy } from "@/lib/policy/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { AuthorizationDeniedError } from "./access-errors";
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

/**
 * Membership is business-scope access (tenant binding) and is distinct from
 * feature/module discoverability checks.
 */
export function requireMembership(context: AccessContext): AccessContext {
  if (context.elevatedAuthority.hasOperationalElevatedAuthority) {
    return context;
  }

  if (context.membership.isMember) {
    return context;
  }

  throw new AuthorizationDeniedError(
    `Membership required for scope ${context.scopeType}${context.scopeId ? `:${context.scopeId}` : ""}`,
  );
}

/**
 * Alias for migration clarity: business authorization at scope level should
 * use membership/elevated-authority checks, not module feature checks.
 */
export function requireBusinessScopeAccess(context: AccessContext): AccessContext {
  return requireMembership(context);
}

/**
 * Module entry/discoverability guard only.
 *
 * This helper must not be the sole authorization for business writes.
 */
export async function requireModuleAccess(
  feature: FeatureInput,
  context: AccessContext,
  options?: { dest?: string },
): Promise<AccessContext> {
  try {
    await requireFeatureAccess(feature, options);
  } catch (error) {
    if (isRedirectDenial(error)) {
      throw new AuthorizationDeniedError(`Module access denied for feature ${String(feature)}`);
    }

    throw error;
  }

  return context;
}

function isHrAction(action: string, resource: string): boolean {
  const source = `${action}:${resource}`.toLowerCase();
  return source.includes("hr") || source.includes("payroll") || source.includes("employee");
}

function isRedirectDenial(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * Canonical HR business authorization check for house-scoped routes.
 *
 * Use this for HR/payroll business operations in addition to module access.
 */
export async function requireHrBusinessAccess(context: AccessContext): Promise<AccessContext> {
  if (context.scopeType !== "house" || !context.scopeId) {
    return context;
  }

  const supabase = await createServerSupabaseClient();
  const hrDecision = await requireHrAccess(supabase, context.scopeId);
  if (!hrDecision.allowed) {
    throw new AuthorizationDeniedError(`HR access denied for house scope ${context.scopeId}`);
  }

  return context;
}

export async function requireActionPermission(
  action: string,
  resource: string,
  context: AccessContext,
): Promise<AccessContext> {
  if (isHrAction(action, resource)) {
    await requireHrBusinessAccess(context);
  }

  const allowed = await evaluatePolicy({ action, resource });
  if (!allowed) {
    throw new AuthorizationDeniedError(`Action permission denied for ${action}:${resource}`);
  }

  return context;
}
