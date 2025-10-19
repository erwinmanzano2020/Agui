alter table public.tenant_theme
  add column if not exists preset text;

alter table public.tenant_theme
  drop constraint if exists tenant_theme_preset_valid;

alter table public.tenant_theme
  add constraint tenant_theme_preset_valid
  check (
    preset is null
      or preset in (
        'black',
        'charcoal',
        'pearl',
        'white',
        'emerald',
        'royal',
        'pearl-blue'
      )
  );

update public.tenant_theme
set preset = coalesce(preset, 'charcoal');

alter table public.tenant_theme
  alter column preset set default 'charcoal';
