-- UI terms configuration for tenant-customizable labels.
create table if not exists public.ui_terms (
  id text primary key default 'default',
  terms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.update_ui_terms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_ui_terms_updated_at
before update on public.ui_terms
for each row
execute function public.update_ui_terms_updated_at();

insert into public.ui_terms (id, terms)
values (
  'default',
  jsonb_build_object(
    'alliance', 'Alliance',
    'guild', 'Guild',
    'company', 'Company',
    'team', 'Team',
    'alliance_pass', 'Alliance Pass',
    'guild_card', 'Guild Card',
    'house_pass', 'Patron Pass'
  )
)
on conflict (id) do nothing;
