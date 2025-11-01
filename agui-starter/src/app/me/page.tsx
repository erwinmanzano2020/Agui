import Link from "next/link";
import type { ReactNode } from "react";

import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";
import { redirect } from "next/navigation";

type Tile = {
  href: string;
  title: string;
  desc: string;
  icon?: ReactNode;
};

function LoyaltyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function EmpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function BizIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...props}>
      <path d="M4 20V8l8-4 8 4v12z" />
    </svg>
  );
}

function GMIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...props}>
      <path d="M12 2l3 6 6 .5-4.5 4 1.5 6-6-3-6 3 1.5-6L3 8.5 9 8l3-6z" />
    </svg>
  );
}

export default async function MePage() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const caps = await getCapabilitiesForUser(session.user.id);

  const tiles: Tile[] = [];

  if (caps.loyaltyBrands.length > 0) {
    tiles.push({
      href: "/me/loyalty",
      title: "Loyalty Pass",
      desc:
        caps.loyaltyBrands.length === 1
          ? "1 brand"
          : `${caps.loyaltyBrands.length} brands`,
      icon: <LoyaltyIcon className="opacity-80" />,
    });
  }

  if (caps.employeeBrands.length > 0) {
    tiles.push({
      href: "/me/employment",
      title: "My Employment",
      desc:
        caps.employeeBrands.length === 1
          ? "1 brand"
          : `${caps.employeeBrands.length} brands`,
      icon: <EmpIcon className="opacity-80" />,
    });
  }

  if (caps.ownerBrands.length > 0) {
    tiles.push({
      href: "/me/businesses",
      title:
        caps.ownerBrands.length === 1
          ? `${caps.ownerBrands[0].name}`
          : "My Businesses",
      desc:
        caps.ownerBrands.length === 1
          ? "Manage your business"
          : `Manage ${caps.ownerBrands.length} businesses`,
      icon: <BizIcon className="opacity-80" />,
    });
  }

  if (caps.isGM) {
    tiles.push({
      href: "/me/admin",
      title: "Game Master",
      desc: "Global controls & settings",
      icon: <GMIcon className="opacity-80" />,
    });
  }

  const hasAny = tiles.length > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Me</h1>

      {hasAny ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex items-start gap-3 rounded-2xl border p-4 shadow transition hover:shadow-md"
            >
              <div className="mt-1">{tile.icon}</div>
              <div>
                <div className="text-lg font-medium">{tile.title}</div>
                <div className="text-sm opacity-70">{tile.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="opacity-70">
          Walang apps pa for you. Enroll in a Loyalty Pass or ask your employer to
          add you.
        </p>
      )}
    </main>
  );
}
