#!/usr/bin/env ts-node
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for Supabase seeding");
  }

  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for Supabase seeding");
  }

  return createClient<Database>(url, serviceKey);
}

async function main() {
  const db = createServiceClient();

  // create a sample entity
  const entityInsert: Database["public"]["Tables"]["entities"]["Insert"] = {
    display_name: "Demo Player",
  };

  const { data: ent, error: entError } = await db
    .from("entities")
    .insert(entityInsert)
    .select()
    .single();
  if (entError) throw entError;
  if (!ent) throw new Error("Failed to insert entity");
  const entity = ent as Database["public"]["Tables"]["entities"]["Row"];

  // create a sample merchant guild
  const guildInsert: Database["public"]["Tables"]["guilds"]["Insert"] = {
    slug: "demo-guild",
    name: "Demo Merchant Guild",
    guild_type: "MERCHANT",
  };

  const { data: g, error: guildError } = await db
    .from("guilds")
    .insert(guildInsert)
    .select()
    .single();
  if (guildError) throw guildError;
  if (!g) throw new Error("Failed to insert guild");
  const guild = g as Database["public"]["Tables"]["guilds"]["Row"];

  // role: guild_member
  const roleInsert: Database["public"]["Tables"]["guild_roles"]["Insert"] = {
    guild_id: guild.id,
    entity_id: entity.id,
    role: "guild_member",
  };

  const { error: roleError } = await db.from("guild_roles").insert(roleInsert);
  if (roleError) throw roleError;

  console.log("Seeded.");
}
main();
