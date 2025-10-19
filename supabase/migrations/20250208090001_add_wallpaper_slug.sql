alter table public.tenant_theme
  add column if not exists wallpaper_slug text;
