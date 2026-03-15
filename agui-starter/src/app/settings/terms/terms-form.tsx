"use client";

import * as React from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UiTerms } from "@/lib/ui-terms";
import { updateTerms } from "./actions";

export default function TermsForm({ initial }: { initial: UiTerms }) {
  const [terms, setTerms] = React.useState(initial);
  const [pending, start] = useTransition();

  function onChange<K extends keyof UiTerms>(key: K, val: string) {
    setTerms((t) => ({ ...t, [key]: val }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    (Object.keys(terms) as (keyof UiTerms)[]).forEach((k) => fd.append(k, terms[k]));
    start(async () => {
      await updateTerms(fd);
    });
  }

  const Row = ({ label, name }: { label: string; name: keyof UiTerms }) => (
    <label className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="h-9 px-3 rounded-[var(--agui-radius)] bg-card border border-border"
        value={terms[name]}
        onChange={(e) => onChange(name, e.target.value)}
        name={name}
      />
    </label>
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="text-lg font-semibold">Public Labels</div>
          <Row label="Alliance" name="alliance" />
          <Row label="Guild" name="guild" />
          <Row label="Company" name="company" />
          <Row label="Team" name="team" />
          <div className="text-lg font-semibold pt-2">Loyalty Terms</div>
          <Row label="Alliance Pass" name="alliance_pass" />
          <Row label="Guild Card" name="guild_card" />
          <Row label="House Pass" name="house_pass" />
          <div className="pt-2">
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
