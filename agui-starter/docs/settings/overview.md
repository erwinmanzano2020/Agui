# Centralized Settings

This module introduces a three-tiered settings stack so configuration stays consistent across the platform while still letting businesses fine-tune the experience.

## Hierarchy

Settings are resolved in the following order:

1. **GM default** – platform-wide baseline managed by the Game Master team.
2. **Business override** – applies to every branch inside a house.
3. **Branch override** – most granular layer. If no branch override exists, the effective value falls back to the business override (or GM default when the business does not specify an override).

Each update creates an audit entry and bumps the version so changes remain traceable. Example:

- GM sets `receipt.footer_text = "Thank you"`.
- A business overrides it with `"See you soon"`.
- Branch `A` overrides the footer with `"Pickup ready in 10 minutes"` while branch `B` inherits the business copy.

The resulting values are:

| Scope       | Effective footer                             |
|-------------|-----------------------------------------------|
| GM default  | `Thank you`                                   |
| Business    | `See you soon`                                |
| Branch A    | `Pickup ready in 10 minutes` (local override) |
| Branch B    | `See you soon` (business fallback)            |

## Preview Panel

The settings UI renders a live preview that updates within ~120 ms as you edit fields. Tabs include Receipt, POS Theme, and Email/SMS. Compare Mode splits the view between the global defaults and the effective value for the current scope so you can see the impact of an override before saving. Print helpers simulate both `thermal80` and `A4` profiles.

## RBAC

| Actor                     | Read GM | Write GM | Read Business | Write Business | Read Branch | Write Branch |
|---------------------------|---------|----------|---------------|----------------|-------------|--------------|
| Game Master               | ✅      | ✅       | ✅            | ✅             | ✅          | ✅           |
| Business owner / admin    | ✅ (for their houses) | ❌ | ✅ (their houses) | ✅ (their houses) | ✅ (their branches) | ✅ (their branches) |
| Branch manager            | ✅ (for their house) | ❌ | ✅ (their house) | ❌ | ✅ (their branch) | ✅ (their branch) |
| Anonymous / unauthenticated | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

RLS policies enforce these constraints and audit rows remain GM-readable only.

## Adding a setting key

1. **Supabase migration** – add the key to `settings_catalog` (type, description, category, meta, default value) and, if desired, seed a GM value in `settings_values`.
2. **Type catalog** – append the definition in `src/lib/settings/catalog.ts` so TypeScript knows the key, type, default value, and metadata.
3. **UI rendering** – the auto-generated form uses the catalog metadata, so most keys only require the two steps above. Add custom rendering logic if the new key needs a bespoke component.
4. **Docs/tests** – describe any special behavior (validation rules, meta flags) and extend `src/lib/settings/__tests__/server.test.ts` if the key affects resolution logic.

## Caching and tags

Reads flow through `unstable_cache` with tags:

- `settings:key:<key>` – invalidated whenever a key changes.
- `settings:scope:<scope>:biz:<id>:br:<id|null>` – invalidated for the mutated scope and every dependent scope.

Writers call `revalidateTag` for both the key and the relevant scope tag. Label updates also call `revalidateTag("tiles:user:<id>")` so user-facing tiles refresh immediately.
