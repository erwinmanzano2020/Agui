alter table public.houses
add column if not exists brand_name text,
add column if not exists logo_url text;

create index if not exists houses_brand_name_idx on public.houses (brand_name);
