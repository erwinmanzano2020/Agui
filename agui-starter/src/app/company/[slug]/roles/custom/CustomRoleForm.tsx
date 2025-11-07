"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CreateRoleAction,
  createRoleInitialState,
  type CreateRoleState,
} from "./types";

type AssignablePolicy = {
  id: string;
  key: string;
  action: string;
  resource: string;
  description: string | null;
};

type CustomRoleFormProps = {
  houseId: string;
  houseSlug: string;
  policies: AssignablePolicy[];
  createRoleAction: CreateRoleAction;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create role"}
    </Button>
  );
}

function PolicyRow({ policy, checked, onToggle }: {
  policy: AssignablePolicy;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3 text-sm">
      <input
        type="checkbox"
        name="policies"
        value={policy.id}
        checked={checked}
        onChange={() => onToggle(policy.id)}
        className="mt-1 h-4 w-4"
      />
      <span className="flex flex-col gap-1">
        <span className="font-medium text-foreground">{policy.key}</span>
        <span className="text-xs text-muted-foreground">
          {policy.description || `${policy.action} → ${policy.resource}`}
        </span>
      </span>
    </label>
  );
}

function Message({ state }: { state: CreateRoleState }) {
  if (state.status === "idle") return null;
  const tone = state.status === "success" ? "text-emerald-600" : "text-destructive";
  const text =
    state.status === "success"
      ? "Role created successfully."
      : state.message || "Failed to create role.";
  return <p className={`text-sm ${tone}`}>{text}</p>;
}

export function CustomRoleForm({
  houseId,
  houseSlug,
  policies,
  createRoleAction,
}: CustomRoleFormProps) {
  const [state, formAction] = useFormState(createRoleAction, createRoleInitialState);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setSelected(new Set());
    }
  }, [state.status]);

  const orderedPolicies = useMemo(() => {
    return [...policies].sort((a, b) => a.key.localeCompare(b.key));
  }, [policies]);

  const togglePolicy = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Create a custom role</h2>
        <p className="text-sm text-muted-foreground">
          Name the role and select the policies it should grant.
        </p>
      </div>

      <input type="hidden" name="houseId" value={houseId} />
      <input type="hidden" name="houseSlug" value={houseSlug} />

      <div className="space-y-2">
        <label htmlFor="role-name" className="text-sm font-medium text-foreground">
          Role name
        </label>
        <Input
          id="role-name"
          name="name"
          placeholder="e.g. Inventory Specialist"
          required
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Policies</span>
          <span className="text-xs text-muted-foreground">
            {selected.size} selected
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {orderedPolicies.map((policy) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              checked={selected.has(policy.id)}
              onToggle={togglePolicy}
            />
          ))}
          {orderedPolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policies available.</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Message state={state} />
      </div>
    </form>
  );
}
