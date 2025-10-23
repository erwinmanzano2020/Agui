import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadGuildDetail } from "@/lib/taxonomy/guilds";
import { loadUiTerms } from "@/lib/ui-terms";
import { getSupabase } from "@/lib/supabase";
import { ensureGuildRecord } from "@/lib/taxonomy/guilds-server";
import { getCurrentEntity } from "@/lib/auth/entity";
import { houseTypeValues, type HouseType } from "@/lib/types/taxonomy";

import { createHouse } from "./actions";

const HOUSE_TYPE_LABELS: Record<HouseType, string> = {
  RETAIL: "Retail",
  MANUFACTURER: "Manufacturer",
  BRAND: "Brand",
  SERVICE: "Service",
  WHOLESALE: "Wholesale",
  DISTRIBUTOR: "Distributor",
};

function formatHouseType(type: HouseType): string {
  return HOUSE_TYPE_LABELS[type] ?? type.charAt(0) + type.slice(1).toLowerCase();
}

const selectClasses = cn(
  "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
  "shadow-sm outline-none transition-[border-color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const checkboxClasses = cn(
  "h-4 w-4 rounded border border-border bg-background text-[var(--agui-primary)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const outlineLinkButtonClasses = cn(
  "inline-flex items-center justify-center gap-2 font-medium rounded-[calc(var(--agui-radius))]",
  "transition-[background-color,color,border,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:transform-none",
  "h-9 px-3 text-sm",
  "border text-[var(--agui-on-surface)] border-[color-mix(in_srgb,_var(--agui-card-border)_90%,_transparent)] bg-[var(--agui-card)]",
  "hover:border-[color-mix(in_srgb,_var(--agui-primary)_45%,_var(--agui-card-border)_55%)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_10%,_var(--agui-card)_90%)]",
  "active:scale-[0.99] motion-reduce:active:scale-100",
);

type PageProps = {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function GuildCompanyCreatePage({ params, searchParams }: PageProps) {
  const slug = params.slug;
  const [detail, terms] = await Promise.all([loadGuildDetail(slug), loadUiTerms()]);

  if (!detail) {
    notFound();
  }

  const companyLabel = terms.company;
  const guildLabel = terms.guild;

  const errorParam = searchParams?.error;
  const errorMessage = Array.isArray(errorParam) ? errorParam[0] : errorParam ?? null;

  let supabase: SupabaseClient | null = null;
  let supabaseErrorMessage: string | null = null;
  try {
    supabase = getSupabase();
  } catch {
    supabaseErrorMessage = "Supabase is not configured, so company creation is disabled.";
  }

  let canCreate = false;
  let gateMessage: string | null = supabaseErrorMessage;
  let gateCta: { label: string; href: string } | null = null;

  if (supabase && !gateMessage) {
    try {
      const guildRecord = await ensureGuildRecord(supabase, slug);
      if (!guildRecord) {
        gateMessage = "This guild isn’t ready to host companies yet.";
      } else {
        const entity = await getCurrentEntity({ supabase });
        if (!entity) {
          gateMessage = "Sign in to create a company for this guild.";
        } else {
          const { data: membershipRow, error: membershipError } = await supabase
            .from("guild_roles")
            .select("id")
            .eq("guild_id", guildRecord.id)
            .eq("entity_id", entity.id)
            .maybeSingle();

          if (membershipError) {
            console.error("Failed to verify guild membership while rendering company form", membershipError);
            gateMessage = "We couldn’t verify your membership right now. Try again later.";
          } else if (!membershipRow) {
            gateMessage = `Only ${guildLabel.toLowerCase()} members can create a ${companyLabel.toLowerCase()}.`;
            gateCta = { label: `Join ${detail.name}`, href: `/guild/${slug}/join` };
          } else {
            canCreate = true;
          }
        }
      }
    } catch (error) {
      console.error("Failed to resolve guild while preparing company form", error);
      gateMessage = "We couldn’t load the guild setup required for companies.";
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="space-y-4">
        <Link
          href={`/guild/${detail.slug}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to {detail.name}
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Create a new {companyLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Launch a {companyLabel.toLowerCase()} within {detail.name}. Slugs are generated automatically on save.
          </p>
        </div>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {!canCreate && gateMessage && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Finish setup to continue</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{gateMessage}</p>
            {gateCta && (
              <Link href={gateCta.href} className={outlineLinkButtonClasses}>
                {gateCta.label}
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {canCreate && (
        <Card>
          <CardHeader className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Company details</h2>
            <p className="text-sm text-muted-foreground">
              Provide the basics and we’ll handle the rest, including auto-generating a unique slug.
            </p>
          </CardHeader>
          <CardContent>
            <form action={createHouse} className="space-y-6">
              <input type="hidden" name="guild_slug" value={detail.slug} />

              <div className="space-y-2">
                <label htmlFor="company-name" className="text-sm font-medium text-foreground">
                  {companyLabel} name
                </label>
                <Input
                  id="company-name"
                  name="name"
                  placeholder={`New ${companyLabel}`}
                  required
                  autoComplete="organization"
                />
                <p className="text-xs text-muted-foreground">
                  The slug is generated from this name when you create the {companyLabel.toLowerCase()}.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="company-type" className="text-sm font-medium text-foreground">
                  {companyLabel} type
                </label>
                <select id="company-type" name="house_type" className={selectClasses} required defaultValue="">
                  <option value="" disabled>
                    Select a type
                  </option>
                  {houseTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {formatHouseType(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Address basics</span>
                <div className="grid gap-4">
                  <Input
                    name="address_line1"
                    placeholder="Street address"
                    autoComplete="address-line1"
                  />
                  <Input
                    name="address_line2"
                    placeholder="Apartment, suite, etc. (optional)"
                    autoComplete="address-line2"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="address_city" placeholder="City" autoComplete="address-level2" />
                    <Input name="address_region" placeholder="Region / State" autoComplete="address-level1" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="address_postal_code" placeholder="Postal code" autoComplete="postal-code" />
                    <Input name="address_country" placeholder="Country" autoComplete="country-name" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  These details help with receipts and future automations. Leave blank if not applicable yet.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-foreground">Tax flags</span>
                <div className="space-y-2 text-sm text-foreground">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="tax_vat_registered" className={checkboxClasses} />
                    <span>VAT registered</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="tax_exempt_sales" className={checkboxClasses} />
                    <span>Allows tax-exempt sales</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-foreground">Seed parties (optional)</span>
                <p className="text-xs text-muted-foreground">
                  We can create starter teams for you. You can always add more later.
                </p>
                <div className="space-y-2 text-sm text-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="seed_parties"
                      value="departments"
                      className={checkboxClasses}
                    />
                    <span>Departments — organize crews by discipline.</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="seed_parties" value="branches" className={checkboxClasses} />
                    <span>Branches — track regional storefronts or hubs.</span>
                  </label>
                </div>
              </div>

              <CardFooter className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  You’ll be recorded as the owner of this {companyLabel.toLowerCase()} immediately after creation.
                </p>
                <Button type="submit">Create {companyLabel}</Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
