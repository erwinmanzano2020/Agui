"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function IssueForm({ scope }: { scope: "GUILD" | "HOUSE" }) {
  const [kind, setKind] = React.useState<"phone" | "email">("phone");
  const [value, setValue] = React.useState("");
  const [incog, setIncog] = React.useState(false);
  const [resp, setResp] = React.useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/passes/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, identifier: { kind, value }, incognitoDefault: incog }),
    }).then(r => r.json());
    setResp(JSON.stringify(res, null, 2));
  }

  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Identifier</span>
            <div className="flex gap-2">
              <select value={kind} onChange={(e)=>setKind(e.target.value as "phone" | "email")} className="h-9 px-2 rounded-[var(--agui-radius)] bg-card border border-border">
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
              <input value={value} onChange={(e)=>setValue(e.target.value)} className="h-9 flex-1 px-3 rounded-[var(--agui-radius)] bg-card border border-border" placeholder="+63917…" required/>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incog} onChange={(e)=>setIncog(e.target.checked)} />
            <span className="text-muted-foreground">Incognito by default</span>
          </label>
          <Button type="submit">Issue Card</Button>
        </form>

        {resp && (
          <pre className="mt-3 text-xs bg-muted p-3 rounded-[var(--agui-radius)] overflow-auto">{resp}</pre>
        )}
      </CardContent>
    </Card>
  );
}
