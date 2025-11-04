-- 20251104T_seed_gm_identifiers.sql
-- Use your GM entity id
-- Provided by Erwin: a45f083f-ee47-42f3-8854-2180589d18b3

do $$
declare
  v_gm uuid := 'a45f083f-ee47-42f3-8854-2180589d18b3'::uuid;
begin
  -- Ensure GM entity exists and is flagged
  insert into public.entities (id, is_gm)
  values (v_gm, true)
  on conflict (id) do update set is_gm = true;

  -- Upsert email
  insert into public.entity_identifiers (entity_id, kind, issuer, value_norm, meta, verified_at)
  values (v_gm, 'email', 'SYSTEM', 'erwinmanzano24@gmail.com', '{}', now())
  on conflict (kind, coalesce(encode(value_hash, 'hex'), value_norm))
  do update set entity_id = excluded.entity_id;

  -- Upsert phone (PH sample)
  insert into public.entity_identifiers (entity_id, kind, issuer, value_norm, meta, verified_at)
  values (v_gm, 'phone', 'SYSTEM', '+639958836320', '{"country":"PH"}', now())
  on conflict (kind, coalesce(encode(value_hash, 'hex'), value_norm))
  do update set entity_id = excluded.entity_id;
end $$;
