begin;

-- GAP-024 Gate A activation-history trigger privilege follow-up.
--
-- The activation guard must inspect the append-only authorization-history table while
-- ordinary service-role producers retain no direct access to that audit relation.
-- Elevate only this trigger function; keep a fixed search_path and keep direct history
-- table privileges revoked.

alter function public.hr_guard_attendance_fact_activation()
  security definer;

alter function public.hr_guard_attendance_fact_activation()
  set search_path = pg_catalog, public;

revoke all on function public.hr_guard_attendance_fact_activation()
  from public, anon, authenticated, service_role;

comment on function public.hr_guard_attendance_fact_activation() is
  'GAP-024 Gate A SECURITY DEFINER activation guard with fixed search_path; verifies prior canonical classification history without granting producers direct history-table access.';

commit;
