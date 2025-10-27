"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

export type InviteRoleOption = {
  value: string;
  label: string;
  description?: string;
};

type InviteFormProps = {
  scope: "HOUSE" | "GUILD";
  guildId?: string | null;
  houseId?: string | null;
  roleOptions: InviteRoleOption[];
  heading: string;
  description?: string;
};

export function InviteForm({ scope, guildId, houseId, roleOptions, heading, description }: InviteFormProps) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !role) {
      toast.error("Email and role are required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          scope,
          guildId,
          houseId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? "Failed to send invite");
      }

      toast.success("Invite sent successfully");
      setEmail("");
    } catch (error) {
      console.error("Failed to create invite", error);
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="invite-email">
              Email address
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
            <label className="text-sm font-medium" htmlFor="invite-role">
              Role on join
            </label>
            <select
              id="invite-role"
              className="w-full h-10 rounded-[var(--agui-radius)] border border-border bg-background px-3 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {roleOptions.find((option) => option.value === role)?.description && (
              <p className="text-xs text-muted-foreground">
                {roleOptions.find((option) => option.value === role)?.description}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
