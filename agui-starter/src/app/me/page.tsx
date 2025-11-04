// src/app/me/page.tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import TileGrid from "@/components/me/TileGrid";
import AppTile from "@/components/me/AppTile";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";
import { createServerSupabase } from "@/lib/auth/server";
import { BizIcon, EmployeeIcon, GMIcon, LoyaltyIcon } from "@/components/me/icons";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = await createServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) {
    redirect("/welcome");
  }

  const caps = await getCapabilitiesForUser(userId);

  type TileConfig = {
    href: string;
    title: string;
    desc: string;
    icon: ReactNode;
    testid: string;
  };

  const tiles: TileConfig[] = [];

  tiles.push({
    href: "/me/loyalty",
    title:
      caps.loyaltyBrands.length === 0
        ? "No Loyalty Passes (yet)"
        : "My Loyalty Passes",
    desc:
      caps.loyaltyBrands.length === 0
        ? "Enroll to start earning points & perks"
        : `View ${caps.loyaltyBrands.length} pass${
            caps.loyaltyBrands.length > 1 ? "es" : ""
          }`,
    icon: <LoyaltyIcon className="opacity-80" />,
    testid: "tile-loyalty",
  });

  if (caps.employeeBrands.length > 0) {
    tiles.push({
      href: "/me/work",
      title:
        caps.employeeBrands.length === 1
          ? `${caps.employeeBrands[0].name}`
          : "My Workplace",
      desc:
        caps.employeeBrands.length === 1
          ? "Open your employee portal"
          : `You’re linked to ${caps.employeeBrands.length} workplaces`,
      icon: <EmployeeIcon className="opacity-80" />,
      testid: "tile-work",
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
      testid: "tile-businesses",
    });
  }

  if (caps.isGM) {
    tiles.push({
      href: "/gm",
      title: "Game Master",
      desc: "Global controls & settings",
      icon: <GMIcon className="opacity-80" />,
      testid: "tile-gm",
    });
  }

  return (
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <h1 className="text-xl md:text-2xl font-semibold">Me</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your apps & shortcuts.
      </p>

      <div className="mt-4">
        <TileGrid>
          {tiles.map((t) => (
            <AppTile
              key={t.testid}
              href={t.href}
              title={t.title}
              desc={t.desc}
              icon={t.icon}
              data-testid={t.testid}
            />
          ))}
        </TileGrid>

        {tiles.length === 0 ? (
          <div className="mt-6 text-sm text-muted-foreground">
            Walang apps pa for you. Enroll in a Loyalty Pass or ask your
            employer to add you.
          </div>
        ) : null}
      </div>
    </main>
  );
}
