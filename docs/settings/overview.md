# Centralized Settings Hierarchy

The centralized settings system lets global management (GM) define platform defaults, while businesses and their branches can override those defaults when needed.

## Hierarchy

Settings resolve in three levels:

1. **Branch** – Most specific. If a branch has an override for a key, it wins.
2. **Business** – Business-wide override that applies to all branches unless a branch override exists.
3. **GM** – Global default defined in the catalog. When no overrides exist, the GM default applies.

Each change is recorded in `settings_audit`, including the actor id, previous value, new value, and timestamp.

## Catalog

All keys live in `settings_catalog`. Important columns:

- `key` – Unique identifier (`receipt.footer_text`).
- `type` – `string`, `boolean`, `number`, or `json`.
- `category` – Grouping for the UI (receipt, pos, labels, sop).
- `meta` – JSON metadata for UI hints (`options`, `enforced`, validation rules).
- `default_value` – JSON payload used as the GM default.

To add a new key:

1. Insert a row into `settings_catalog` with the default JSON value.
2. Update the TypeScript catalog at `src/lib/settings/catalog.ts` with the same metadata so helper types remain accurate.
3. (Optional) Extend UI logic if the meta requires custom rendering.

## Preview Panel

Settings pages include a **Live Preview**. User edits update the preview within ~120 ms via a debounced local state. Compare mode shows a side-by-side Global vs Effective preview, and the panel adjusts dynamically to display receipt, POS, or email scenarios.

## RBAC

| Role | Read | Write |
| --- | --- | --- |
| GM | All scopes | All scopes |
| Business Admin | GM defaults, their business, branches under their business | Business scope for their business, branch scope for branches they manage |
| Branch Manager | GM defaults, their business, their branch | Branch scope for their branch |

Server helpers and API routes enforce this matrix using scope-aware guards and request headers (`x-user-role`, `x-business-id`, `x-branch-id`).

## Revalidation & Caching

- Reads leverage `unstable_cache` with tags: `settings:key:<key>` and `settings:scope:<scope>:biz:<id>:br:<id>`.
- Writes and resets call `revalidateTag` for those tags so subsequent reads observe the change immediately.
- Label-oriented keys also trigger `tiles:user:*` tags to keep dashboard tiles fresh.

## Preview Workflow

1. User edits a field (values remain local until “Save all”).
2. Unsaved changes banner appears; the Live Preview updates in-place.
3. “Compare mode” splits the preview to show global defaults versus pending effective values.
4. “Reset to default” removes overrides at the current scope and snaps the preview back to the parent value.

## Tests

- **Unit tests** (recommended location `src/lib/settings/__tests__`) should cover resolution order, audit trails, and type coercion.
- **Integration tests** should exercise API RBAC (GM vs Business vs Branch) and inheritance fallbacks.
- **E2E** should simulate GM → Business → Branch editing and confirm the preview updates.

Run the usual quality commands before committing:

```bash
npm run lint
npm run typecheck
npm run build
```
