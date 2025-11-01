// src/app/me/page.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";
import { AppTile } from "@/components/me/AppTile";
import { BizIcon, EmployeeIcon, GMIcon, LoyaltyIcon } from "@/components/me/icons";

export const dynamic = "force-dynamic";

type Tile = {
  href: string;
  title: string;
  desc?: string;
  icon?: ReactNode;
};

export default async function MePage() {
  const { session } = await getServerSession();
  if (!session) redirect("/welcome");

  const userId = session.user.id;
  const caps = await getCapabilitiesForUser(userId);

  const tiles: Tile[] = [];

  tiles.push({
    href: "/me/loyalty",
    title: "Loyalty Pass",
    desc:
      caps.loyaltyBrands.length > 0
        ? `You have ${caps.loyaltyBrands.length} membership${
            caps.loyaltyBrands.length > 1 ? "s" : ""
          }`
        : "Join programs and earn rewards",
    icon: <LoyaltyIcon className="opacity-80" />,
  });

  for (const b of caps.employeeBrands) {
    tiles.push({
      href: `/brand/${b.slug}/employee`,
      title: `${b.name} · Employee`,
      desc: "Pass & status",
      icon: <EmployeeIcon className="opacity-80" />,
    });
  }

  if (caps.ownerBrands.length > 0) {
    tiles.push({
      href:
        caps.ownerBrands.length === 1
          ? `/brand/${caps.ownerBrands[0].slug}`
          : "/me/businesses",
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
      href: "/gm",
      title: "Game Master",
      desc: "Global controls & settings",
      icon: <GMIcon className="opacity-80" />,
    });
  }

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold mb-3">Me</h1>
      <p className="text-sm opacity-75 mb-6">Your personal hub. Tap an app to continue.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {tiles.map((t) => (
          <AppTile key={t.href} href={t.href} title={t.title} desc={t.desc} icon={t.icon} />
        ))}
      </div>
    </main>
  );
}
