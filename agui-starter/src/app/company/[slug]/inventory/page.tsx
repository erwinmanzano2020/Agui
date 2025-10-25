import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type InventoryRow = {
  id: string;
  sku: string | null;
  price_centavos: number | null;
  items: {
    name: string | null;
    brand: string | null;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return null;
  return String(value);
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceInventoryRow(row: unknown): InventoryRow | null {
  if (!isRecord(row)) return null;

  const itemsRaw = row["items"];
  const nested = Array.isArray(itemsRaw)
    ? itemsRaw.find((item): item is Record<string, unknown> => isRecord(item)) ?? null
    : isRecord(itemsRaw)
      ? itemsRaw
      : null;

  const items = nested
    ? {
        name: asStringOrNull(nested["name"] ?? null),
        brand: asStringOrNull(nested["brand"] ?? null),
      }
    : null;

  return {
    id: asStringOrNull(row["id"]) ?? "",
    sku: asStringOrNull(row["sku"]),
    price_centavos: asNumberOrNull(row["price_centavos"]),
    items,
  };
}

export default async function CompanyInventory({ params }: { params: { slug: string } }) {
  const db = getSupabase();
  if (!db) return notFound();

  const { data: house } = await db
    .from("houses")
    .select("id,slug,name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!house) return notFound();

  const { data } = await db
    .from("house_items")
    .select("id, sku, price_centavos, items(name, brand)")
    .eq("house_id", house.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows: InventoryRow[] = Array.isArray(data)
    ? data
        .map((row) => coerceInventoryRow(row))
        .filter((row): row is InventoryRow => Boolean(row))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Inventory</div>
        <Link className="underline" href={`/company/${house.slug}/inventory/scan`}>
          Scan / Adopt
        </Link>
      </div>
      <Card>
        <CardContent className="py-4">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items yet.</div>
          ) : (
            <div className="text-sm">
              {rows.map((row) => {
                const price = Number(row.price_centavos ?? 0);
                const formattedPrice = `₱${(price / 100).toFixed(2)}`;
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between border-b border-border py-2 last:border-0"
                  >
                    <div>
                      {row.items?.name ?? "—"}{" "}
                      <span className="text-muted-foreground">{row.sku ? `• ${row.sku}` : ""}</span>
                    </div>
                    <div className="font-mono">{formattedPrice}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
