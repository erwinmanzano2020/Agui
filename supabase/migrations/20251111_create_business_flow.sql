-- Create Business flow seeds and policies

insert into public.policies (key, action, resource, description)
values (
  'houses:create',
  'houses:create',
  'houses',
  'User may create a new business/workspace'
)
on conflict (key) do update set
  action = excluded.action,
  resource = excluded.resource,
  description = excluded.description;

-- Attach houses:create policy to owner / GM roles when available
DO $$
DECLARE
  has_roles_table boolean := EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'roles'
  );
  has_key_column boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'key'
  );
  has_slug_column boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'slug'
  );
BEGIN
  IF NOT has_roles_table THEN
    RETURN;
  END IF;

  IF has_key_column THEN
    INSERT INTO public.role_policies (role_id, policy_id)
    SELECT r.id, p.id
    FROM public.roles r
    JOIN public.policies p ON p.key = 'houses:create'
    WHERE r.key IN ('owner', 'gm')
    ON CONFLICT DO NOTHING;
  ELSIF has_slug_column THEN
    INSERT INTO public.role_policies (role_id, policy_id)
    SELECT r.id, p.id
    FROM public.roles r
    JOIN public.policies p ON p.key = 'houses:create'
    WHERE r.slug IN ('owner', 'gm', 'house_owner', 'house_manager')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Ensure slug uniqueness helper exists (idempotent for legacy data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'houses'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS houses_slug_unique ON public.houses (slug)';
  END IF;
END $$;

-- Allow authenticated users with houses:create policy (or GM) to insert houses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'houses'
  ) THEN
    EXECUTE 'ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "houses_create_with_policy" ON public.houses;';
    EXECUTE $$
      CREATE POLICY "houses_create_with_policy"
      ON public.houses
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.current_entity_is_gm()
        OR EXISTS (
          SELECT 1
          FROM public.entity_policies ep
          WHERE ep.entity_id = public.current_entity_id()
            AND (ep.policy_key = ''houses:create'' OR ep.action = ''houses:create'')
        )
      )
    $$;
  END IF;
END $$;
