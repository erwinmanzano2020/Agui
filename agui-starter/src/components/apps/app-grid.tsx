// src/components/apps/app-grid.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Capabilities } from "@/lib/roles/capabilities";

type Tile = {
  key: string;
  title: string;
  description?: string;
  href: string;
};

function tile(href: string, title: string, description?: string): Tile {
  return { key: href, href, title, description };
}

function loyaltyTile(loyaltyBrandCount: number): Tile {
  // Open the only brand directly; otherwise go to selector
  const href = loyaltyBrandCount === 1 ? "/me/loyalty" : "/me/loyalty";
  return tile(href, "Loyalty Pass", "View and use your passes");
}

function employeeBrandTile(slug: string, name: string): Tile {
  return tile(`/brand/${slug}`, name, "Your workplace tools");
}

function myBusinessesTile(): Tile {
  return tile("/me/businesses", "My Businesses", "Manage your brands");
}

function adminTile(): Tile {
  return tile("/admin", "Admin", "GM controls & settings");
}

export function AppGrid({ caps }: { caps: Capabilities }) {
  const tiles = useMemo<Tile[]>(() => {
    const t: Tile[] = [];
    // Loyalty (customers)
    if (caps.loyaltyBrands.length > 0) {
      t.push(loyaltyTile(caps.loyaltyBrands.length));
    }

    // Employees see a tile per brand they work in
    for (const b of caps.employeeOf) {
      t.push(employeeBrandTile(b.slug, b.name));
    }

    // Owners see a "My Businesses" aggregator (even if 1; keeps UX stable)
    if (caps.ownerOf.length > 0) {
      t.push(myBusinessesTile());
    }

    // GM gets Admin
    if (caps.gmApps) {
      t.push(adminTile());
    }

    // If literally no capabilities yet, still show Loyalty entry
    if (t.length === 0) {
      t.push(loyaltyTile(0));
    }
    return t;
  }, [caps]);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {tiles.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className="group rounded-2xl border p-4 transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2"
        >
          <div className="mb-1 text-base md:text-lg font-medium">{t.title}</div>
          {t.description ? (
            <div className="text-xs md:text-sm text-muted-foreground">{t.description}</div>
          ) : null}
        </Link>
      ))}
    </section>
  );
}
