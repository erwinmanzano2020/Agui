"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CreateHouseInput } from "./actions";
import { createHouse } from "./actions";

const HOUSE_TYPES = ["RETAIL", "MANUFACTURER", "BRAND", "SERVICE", "WHOLESALE", "DISTRIBUTOR"] as const;
type HouseType = (typeof HOUSE_TYPES)[number];
type OwnerIdentifierKind = NonNullable<CreateHouseInput["owner_identifier_kind"]>;

function isHouseType(value: FormDataEntryValue | null): value is HouseType {
  return typeof value === "string" && HOUSE_TYPES.includes(value as HouseType);
}

function isOwnerKind(value: FormDataEntryValue | null): value is OwnerIdentifierKind {
  return value === "phone" || value === "email";
}

export default function NewCompanyForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);

    const typeValue = fd.get("type");
    const houseType: HouseType = isHouseType(typeValue) ? typeValue : "RETAIL";

    const ownerKindValue = fd.get("owner_kind");
    const ownerKind: OwnerIdentifierKind | undefined = isOwnerKind(ownerKindValue)
      ? ownerKindValue
      : undefined;

    const ownerValueRaw = fd.get("owner_value");
    const ownerValue = typeof ownerValueRaw === "string" ? ownerValueRaw.trim() : "";

    const input: CreateHouseInput = {
      name: String(fd.get("name") || "").trim(),
      type: houseType,
      address: String(fd.get("address") || ""),
      tax_flags: String(fd.get("tax_flags") || ""),
      seed_parties: fd.get("seed_parties") === "on",
      owner_identifier_kind: ownerKind,
      owner_identifier_value: ownerValue.length > 0 ? ownerValue : undefined,
    };

    try {
      const res = await createHouse(slug, input);
      if (res?.ok) router.replace(`/company/${res.slug}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create company";
      setErr(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="text-lg font-semibold">Create Company</div>

          <label className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Name</span>
            <input
              name="name"
              required
              className="h-9 w-full rounded-[var(--agui-radius)] border border-border bg-card px-3"
            />
          </label>

          <label className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Type</span>
            <select
              name="type"
              className="h-9 w-full rounded-[var(--agui-radius)] border border-border bg-card px-2"
            >
              {HOUSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Address</span>
            <input
              name="address"
              className="h-9 w-full rounded-[var(--agui-radius)] border border-border bg-card px-3"
            />
          </label>

          <label className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Tax Flags</span>
            <input
              name="tax_flags"
              placeholder='{"vat_registered":true}'
              className="h-9 w-full rounded-[var(--agui-radius)] border border-border bg-card px-3"
            />
          </label>

          <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Seed Parties</span>
            <input type="checkbox" name="seed_parties" className="h-5 w-5" />
          </div>

          {/* Fallback if no session bound entity */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">Owner (fallback)</span>
            <div className="flex gap-2">
              <select
                name="owner_kind"
                className="h-9 rounded-[var(--agui-radius)] border border-border bg-card px-2"
              >
                <option value="">(use current)</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
              <input
                name="owner_value"
                placeholder="+63917…"
                className="h-9 flex-1 rounded-[var(--agui-radius)] border border-border bg-card px-3"
              />
            </div>
          </div>

          {err && <div className="text-sm text-red-500">{err}</div>}

          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create Company"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
