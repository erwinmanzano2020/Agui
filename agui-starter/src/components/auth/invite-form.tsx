"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/session-context";

export type InviteRoleOption = {
  value: string;
  label: string;
  description?: string;
};

export type InviteScopeOption =
  | ({
      type: "HOUSE";
      id: string;
      label: string;
      note?: string;
      guildId?: string | null;
      roleOptions: InviteRoleOption[];
    })
  | ({
      type: "GUILD";
      id: string;
      label: string;
      note?: string;
      roleOptions: InviteRoleOption[];
    });

type InviteFormProps = {
  scopes: InviteScopeOption[];
  heading: string;
  description?: string;
  defaultScopeId?: string;
  defaultRoles?: string[] | Record<string, string[]>;
  emptyMessage?: string;
};

function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold leading-none tracking-tight">{children}</h2>;
}

const NO_SCOPE_MESSAGE =
  "You don’t have any organizations or teams you can invite to yet. Ask a Game Master or Owner to grant you invite permissions.";

function resolveDefaultRoles(
  scope: InviteScopeOption | undefined,
  preferred?: string[] | Record<string, string[]>,
): string[] {
  if (!scope) {
    return [];
  }

  const preferredList = Array.isArray(preferred)
    ? preferred
    : preferred?.[scope.id] ?? [];

  if (preferredList && preferredList.length > 0) {
    const allowed = new Set(scope.roleOptions.map((option) => option.value));
    const valid = preferredList.filter((role) => allowed.has(role));
    if (valid.length > 0) {
      return valid;
    }
  }

  if (scope.roleOptions.length > 0) {
    return [scope.roleOptions[0].value];
  }

  return [];
}

export function InviteForm({
  scopes,
  heading,
  description,
  defaultScopeId,
  defaultRoles,
  emptyMessage = "No eligible organizations found.",
}: InviteFormProps) {
  const toast = useToast();
  const { viewAs } = useSession();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userSelectedScope, setUserSelectedScope] = useState(false);

  const hasScopes = scopes?.length ? scopes.length > 0 : false;

  const scopeFromViewAs = useMemo(() => {
    if (!viewAs || !hasScopes) {
      return null;
    }

    for (const option of scopes) {
      if (option.type === "HOUSE" && viewAs.scope === "HOUSE" && option.id === viewAs.houseId) {
        return option.id;
      }
      if (option.type === "GUILD" && viewAs.scope === "GUILD" && option.id === viewAs.guildId) {
        return option.id;
      }
    }

    return null;
  }, [hasScopes, scopes, viewAs]);

  const resolvedDefaultScopeId = useMemo(() => {
    if (!hasScopes) {
      return "";
    }
    return scopeFromViewAs ?? defaultScopeId ?? scopes[0]?.id ?? "";
  }, [defaultScopeId, hasScopes, scopeFromViewAs, scopes]);

  const [scopeId, setScopeId] = useState(resolvedDefaultScopeId);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(() => {
    const scope = scopes.find((option) => option.id === resolvedDefaultScopeId);
    return new Set(resolveDefaultRoles(scope, defaultRoles));
  });

  useEffect(() => {
    if (!hasScopes) {
      if (scopeId !== "") {
        setScopeId("");
      }
      setSelectedRoles((prev) => (prev.size ? new Set() : prev));
      return;
    }

    const targetScopeId = userSelectedScope ? scopeId : resolvedDefaultScopeId;
    if (!targetScopeId) {
      const fallbackId = scopes[0]?.id ?? "";
      if (fallbackId && scopeId !== fallbackId) {
        setScopeId(fallbackId);
      }
      return;
    }

    const exists = scopes.some((option) => option.id === targetScopeId);
    if (!exists) {
      const fallbackId = resolvedDefaultScopeId || scopes[0]?.id || "";
      if (fallbackId && scopeId !== fallbackId) {
        setScopeId(fallbackId);
      }
      return;
    }

    if (!userSelectedScope && scopeId !== resolvedDefaultScopeId) {
      setScopeId(resolvedDefaultScopeId);
    }
  }, [hasScopes, resolvedDefaultScopeId, scopeId, scopes, userSelectedScope]);

  const selectedScope = useMemo(
    () => scopes.find((option) => option.id === scopeId),
    [scopes, scopeId],
  );

  useEffect(() => {
    if (!selectedScope) {
      setSelectedRoles((prev) => (prev.size ? new Set() : prev));
    }
    // NOTE: do NOT include selectedRoles in deps
  }, [selectedScope]);

  useEffect(() => {
    if (!selectedScope) {
      return;
    }

    const preferredRoles = Array.isArray(defaultRoles)
      ? defaultRoles
      : defaultRoles?.[selectedScope.id] ?? [];
    const nextRoles = resolveDefaultRoles(selectedScope, preferredRoles);
    setSelectedRoles((prev) => {
      if (prev.size === nextRoles.length && nextRoles.every((role) => prev.has(role))) {
        return prev;
      }
      return new Set(nextRoles);
    });
  }, [defaultRoles, selectedScope]);

  if (!hasScopes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite employee</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{NO_SCOPE_MESSAGE}</p>
        </CardContent>
      </Card>
    );
  }

  const handleScopeChange = (value: string) => {
    setUserSelectedScope(true);
    setScopeId(value);
    const nextScope = scopes.find((option) => option.id === value);
    setSelectedRoles(new Set(resolveDefaultRoles(nextScope, defaultRoles)));
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((current) => {
      const next = new Set(current);
      if (next.has(role)) {
        if (next.size === 1) {
          return next;
        }
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedScope) {
      toast.error("Select an organization to invite to");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }

    const roles = Array.from(selectedRoles).filter((role) =>
      selectedScope.roleOptions.some((option) => option.value === role),
    );

    if (roles.length === 0) {
      toast.error("Select at least one role");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          scope: selectedScope.type,
          roles,
          guildId:
            selectedScope.type === "HOUSE"
              ? selectedScope.guildId ?? null
              : selectedScope.id,
          houseId: selectedScope.type === "HOUSE" ? selectedScope.id : null,
        }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch (error) {
        console.error("Failed to parse invite response", error);
      }

      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Failed to send invite")
            : "Failed to send invite";
        if (response.status === 403) {
          toast.error("You don’t have permission to invite.");
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      const result = payload as { magicLink?: string | null } | null;
      if (result?.magicLink) {
        try {
          await navigator.clipboard?.writeText(result.magicLink);
          toast.warning("User already exists. Magic link copied to clipboard.");
        } catch {
          toast.warning("User already exists. Copy the link from the response.");
        }
      } else {
        toast.success(`Invite sent to ${trimmedEmail}`);
      }

      setEmail("");
    } catch (error) {
      console.error("Failed to send invite", error);
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  };

  const scopeNote = selectedScope?.note ?? (selectedScope?.type === "GUILD" ? "Guild" : "Company");

  return (
    <Card>
      <CardHeader className="space-y-1">
        <h2 className="text-lg font-semibold">{heading}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="invite-email">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="invite-scope">
              Invite to
            </label>
            {scopes.length <= 1 ? (
              <div className="rounded-[var(--agui-radius)] border border-border bg-muted/20 px-3 py-2 text-sm">
                {selectedScope ? `${scopeNote ?? ""}${scopeNote ? " · " : ""}${selectedScope.label}` : emptyMessage}
              </div>
            ) : (
              <select
                id="invite-scope"
                className="w-full h-10 rounded-[var(--agui-radius)] border border-border bg-background px-3 text-sm"
                value={scopeId}
                onChange={(event) => handleScopeChange(event.target.value)}
              >
                {scopes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {`${option.note ?? (option.type === "GUILD" ? "Guild" : "Company")} · ${option.label}`}
                  </option>
                ))}
              </select>
            )}
            {!selectedScope && (
              <p className="text-xs text-muted-foreground">{emptyMessage}</p>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Role(s)</span>
            {selectedScope ? (
              <div className="grid gap-2">
                {selectedScope.roleOptions.map((option) => {
                  const checked = selectedRoles.has(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer flex-col rounded-[var(--agui-radius)] border px-3 py-2 text-sm transition",
                        checked
                          ? "border-[var(--agui-primary)] bg-[color-mix(in_srgb,_var(--agui-primary)_10%,_transparent)]"
                          : "border-border hover:border-[color-mix(in_srgb,_var(--agui-primary)_45%,_var(--agui-card-border)_55%)]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.label}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleRole(option.value)}
                        />
                      </div>
                      {option.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select an organization first.</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting || !selectedScope}>
            {submitting ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
