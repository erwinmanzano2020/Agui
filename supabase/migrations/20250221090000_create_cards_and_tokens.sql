-- Pass system cards and token scaffolding.
create type if not exists public.card_token_kind as enum ('qr', 'barcode', 'nfc');

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.loyalty_schemes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  card_no text not null,
  status text not null default 'active',
  issued_at timestamptz not null default now(),
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(card_no),
  unique(scheme_id, entity_id)
);

create index if not exists cards_entity_id_idx on public.cards (entity_id);
create index if not exists cards_scheme_id_idx on public.cards (scheme_id);

create trigger set_cards_updated_at
before update on public.cards
for each row
execute function public.touch_updated_at();

create table if not exists public.card_tokens (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  kind public.card_token_kind not null,
  token_hash text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists card_tokens_card_id_idx on public.card_tokens (card_id);
create index if not exists card_tokens_active_idx on public.card_tokens (card_id, active);
create unique index if not exists card_tokens_active_unique on public.card_tokens (card_id, kind) where active;
create unique index if not exists card_tokens_token_hash_unique on public.card_tokens (token_hash);
