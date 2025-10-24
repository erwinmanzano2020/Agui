"use client";

import * as React from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { joinGuild } from "./actions";

export default function JoinForm({ slug }: { slug: string }) {
  const [kind, setKind] = React.useState<"email" | "phone">("phone");
  const [value, setValue] = React.useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = React.useState<{ name: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await joinGuild({ slug, kind, value });
      if (res?.ok) setDone({ name: res.guild.name });
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <div className="text-lg font-semibold">Welcome!</div>
          <div className="text-sm text-muted-foreground">You’ve joined {done.name}.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="text-lg font-semibold">Join this Guild</div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
            <label className="text-muted-foreground">Identifier</label>
            <div className="flex gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "email" | "phone")}
                className="h-9 px-2 rounded-[var(--agui-radius)] bg-card border border-border"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={kind === "phone" ? "+63917…" : "you@example.com"}
                className="h-9 flex-1 px-3 rounded-[var(--agui-radius)] bg-card border border-border"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Joining…" : "Join Guild"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
