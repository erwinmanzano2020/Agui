# Agui Development Operating Principles

These principles are the source of truth for how we ship and maintain Agui. They apply to UI, backend, and database changes.

## Migration-backed database functions
- Any database function or RPC that the UI or other RPCs depend on **must be defined in migrations**. Manual SQL fixes are not allowed because they drift between environments and can vanish on reset.
- When adding or updating a function, include a `notify pgrst, 'reload schema';` statement when PostgREST is involved so schema cache stays fresh.
- Prefer idempotent `create or replace` definitions and guardrails (e.g., `if exists` checks) to keep migrations safe to re-run in preview environments.

## Reliability and safety
- Favor immutable, deterministic helpers (e.g., masking helpers) for data shown in HR/Finance/Identity surfaces.
- Log and fail gracefully in the UI when dependent RPCs are unavailable; linked/unlinked status should remain visible when possible.
