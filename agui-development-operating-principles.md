# Agui Development Operating Principles

- **Migration-back everything the UI/RPCs call.** Any database function, view, or helper that a route or RPC depends on must be added through migrations (never manual-only fixes). Include schema cache reloads when introducing new functions so PostgREST stays in sync.
- Document fixes that unblock production in the devlog to keep operations aligned on what changed and why.
