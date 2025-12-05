-- Grant application roles access to dtr_segments for payroll/DTR flows
-- This mirrors existing client-side Supabase usage that relies on anon/authenticated.
-- Remove or tighten when server-side bridges and RLS policies are in place.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dtr_segments TO anon, authenticated;
