# Devlog

This folder captures notable delivery and debugging history so future PRs can reference prior decisions and avoid regressions.

## How to add an entry
1. Copy `_template.md` into a new file under `docs/devlog/<module>/<slug>.md`.
2. Fill in the metadata and summary, focusing on client choice (authenticated vs `service_role`), tenancy/RLS assumptions, and follow-ups.
3. Link the entry from `docs/devlog/index.md` under the appropriate module section.
4. Update the PR template fields with the devlog entry path.
