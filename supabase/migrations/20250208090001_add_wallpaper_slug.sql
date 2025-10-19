alter table public.tenant_theme
  add column if not exists wallpaper_slug text default 'pearl';

update public.tenant_theme
set wallpaper_slug = coalesce(wallpaper_slug, 'pearl')
where wallpaper_slug is null;
