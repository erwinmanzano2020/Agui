// src/app/me/page.tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import TileGrid from "@/components/me/TileGrid";
import AppTile from "@/components/me/AppTile";
import { getCapabilitiesForUser } from "@/lib/roles/get-capabilities.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchInbox } from "@/lib/inbox/queries.server";
import { BizIcon, EmployeeIcon, GMIcon, LoyaltyIcon } from "@/components/me/icons";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function MePage() {
  let userId: string | null = null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("[/me] getUser error:", error.message);
    }
    userId = data?.user?.id ?? null;
  } catch (error) {
    console.error("[/me] fatal during getUser:", error);
  }

  if (!userId) {
    redirect(`/welcome?next=${encodeURIComponent("/me")}`);
  }

  const caps = await getCapabilitiesForUser(userId);

  if (
    caps.loyaltyBrands.length === 0 &&
    caps.employeeBrands.length === 0 &&
    caps.ownerBrands.length === 0 &&
    !caps.isGM
  ) {
    return (
      <main className="px-4 py-6 md:px-6 lg:px-8">
        <div className="mx-auto max-w-md space-y-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Walang apps pa for you.</h1>
          <p className="text-sm text-muted-foreground">
            Enroll in a Loyalty Pass or ask your employer to add you. You can also apply below:
          </p>
          <div className="grid gap-3">
            <Button asChild className="w-full">
              <Link href="/enroll/loyalty">Enroll to a Loyalty Pass</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/apply/employee">Apply as Employee</Link>
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link href="/apply/business">Register a Business</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const inbox = await fetchInbox();
  const unread = inbox.unreadCount;

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
      href: "/me/admin",
      title: "Game Master",
      desc: "Global controls & settings",
      icon: <GMIcon className="opacity-80" />,
      testid: "tile-gm",
    });
  }

  tiles.push({
    href: "/me/inbox",
    title: "Inbox",
    desc: unread > 0 ? `${unread} unread` : "All caught up",
    icon: (
      <div className="relative">
        <span className="opacity-80">📬</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-2 text-[10px] rounded-full px-1.5 py-[1px] bg-red-500 text-white">
            {unread}
          </span>
        )}
      </div>
    ),
    testid: "tile-inbox",
  });

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
