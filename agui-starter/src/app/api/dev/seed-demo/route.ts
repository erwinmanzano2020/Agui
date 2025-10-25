import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const UNIQUE_VIOLATION = "23505";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;
  const { data: existingRun, error: runError } = await supabase
    .from("demo_seed_runs")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  if (existingRun) {
    return NextResponse.json({ ok: true, seeded: false });
  }

  const guildSlug = "demo-guild";
  const houseSlug = "demo";

  let guildId: string | null = null;
  const { data: existingGuild, error: guildLookupError } = await supabase
    .from("guilds")
    .select("id")
    .eq("slug", guildSlug)
    .maybeSingle();

  if (guildLookupError) {
    return NextResponse.json({ error: guildLookupError.message }, { status: 500 });
  }

  guildId = existingGuild?.id ?? null;

  if (!guildId) {
    const { data: insertedGuild, error: insertGuildError } = await supabase
      .from("guilds")
      .insert({
        slug: guildSlug,
        name: "Demo Guild",
        guild_type: "MERCHANT",
      })
      .select("id")
      .single();

    if (insertGuildError) {
      if (insertGuildError.code === UNIQUE_VIOLATION) {
        const { data: retryGuild, error: retryError } = await supabase
          .from("guilds")
          .select("id")
          .eq("slug", guildSlug)
          .maybeSingle();

        if (retryError) {
          return NextResponse.json({ error: retryError.message }, { status: 500 });
        }

        guildId = retryGuild?.id ?? null;
      } else {
        return NextResponse.json({ error: insertGuildError.message }, { status: 500 });
      }
    } else {
      guildId = insertedGuild.id;
    }
  }

  if (!guildId) {
    return NextResponse.json({ error: "Failed to ensure demo guild" }, { status: 500 });
  }

  let houseId: string | null = null;
  const { data: existingHouse, error: houseLookupError } = await supabase
    .from("houses")
    .select("id")
    .eq("slug", houseSlug)
    .maybeSingle();

  if (houseLookupError) {
    return NextResponse.json({ error: houseLookupError.message }, { status: 500 });
  }

  houseId = existingHouse?.id ?? null;

  if (!houseId) {
    const { data: insertedHouse, error: insertHouseError } = await supabase
      .from("houses")
      .insert({
        slug: houseSlug,
        name: "Demo Company",
        guild_id: guildId,
        house_type: "RETAIL",
      })
      .select("id")
      .single();

    if (insertHouseError) {
      if (insertHouseError.code === UNIQUE_VIOLATION) {
        const { data: retryHouse, error: retryHouseError } = await supabase
          .from("houses")
          .select("id")
          .eq("slug", houseSlug)
          .maybeSingle();

        if (retryHouseError) {
          return NextResponse.json({ error: retryHouseError.message }, { status: 500 });
        }

        houseId = retryHouse?.id ?? null;
      } else {
        return NextResponse.json({ error: insertHouseError.message }, { status: 500 });
      }
    } else {
      houseId = insertedHouse.id;
    }
  }

  if (!houseId) {
    return NextResponse.json({ error: "Failed to ensure demo house" }, { status: 500 });
  }

  const { error: markerError } = await supabase.from("demo_seed_runs").insert({ user_id: userId });
  if (markerError && markerError.code !== UNIQUE_VIOLATION) {
    return NextResponse.json({ error: markerError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seeded: true, guildId, houseId });
}
