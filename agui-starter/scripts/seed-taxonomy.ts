#!/usr/bin/env ts-node
import "dotenv/config";
import { getSupabase } from "@/lib/supabase";

async function main() {
  const db = getSupabase();
  if (!db) throw new Error("Supabase client missing");

  // create a sample entity
  const { data: ent, error: entError } = await db
    .from("entities")
    .insert({ display_name: "Demo Player" })
    .select()
    .single();
  if (entError) throw entError;
  if (!ent) throw new Error("Failed to insert entity");

  // create a sample merchant guild
  const { data: g, error: guildError } = await db
    .from("guilds")
    .insert({
      slug: "demo-guild",
      name: "Demo Merchant Guild",
      guild_type: "MERCHANT",
    })
    .select()
    .single();
  if (guildError) throw guildError;
  if (!g) throw new Error("Failed to insert guild");

  // role: guild_member
  const { error: roleError } = await db
    .from("guild_roles")
    .insert({ guild_id: g.id, entity_id: ent.id, role: "guild_member" });
  if (roleError) throw roleError;

  console.log("Seeded.");
}
main();
