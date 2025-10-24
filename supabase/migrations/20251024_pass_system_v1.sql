-- CARDS: a credential for an entity under a scheme
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.loyalty_schemes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  card_no text unique,
  status text not null default 'ACTIVE',
  flags jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (scheme_id, entity_id)
);

-- TOKENS: scannable secrets (rotatable)
create table if not exists public.card_tokens (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  kind text not null check (kind in ('qr','barcode','nfc')),
  token_hash text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists card_tokens_card_idx on public.card_tokens(card_id, active);

-- helpful index
create index if not exists cards_entity_idx on public.cards(entity_id);
