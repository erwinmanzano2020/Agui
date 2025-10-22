create table if not exists public.tenant_theme (
  id text primary key default 'default',
  preset_name text not null default 'Pearl',
  bg_hsl text not null default '210 40% 98%',
  card_hsl text not null default '0 0% 100%',
  fg_hsl text not null default '222 47% 11%',
  border_hsl text not null default '214 32% 91%',
  muted_hsl text not null default '215 16% 65%',
  icon_container_hex text not null default '#eef1f6',
  label_hex text not null default '#1b1c1f',
  accent_hex text not null default '#0ea5e9',
  ring_opacity double precision not null default 0.14,
  wallpaper_slug text default 'pearl',
  updated_at timestamptz not null default now()
);
