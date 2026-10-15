# Profile Selection

Choose the narrowest profile that matches the project.

## Detection order

1. Explicit project profile from owner/repository governance.
2. Known project identity:
   - Agui -> `agui`
   - VVS Ops Mini -> `vvs-ops-mini`
3. Stack and source-of-truth signals:
   - Next.js/React + Supabase -> `nextjs-supabase`
   - Next.js/React + Apps Script / Google Sheets authority -> `nextjs-appscript`
4. Otherwise -> `greenfield`

## Approved default skills

### greenfield
- systematic-debugging
- risk-aware-testing
- adversarial-review
- add vercel-react-best-practices when React/Next.js is detected
- add ui-ux-pro-max when interface work is in scope

### agui
- systematic-debugging
- risk-aware-testing
- adversarial-review
- vercel-react-best-practices
- ui-ux-pro-max for interface work

CONTROLLED by default for tenancy, identity, authorization, money, attendance, migrations, RPC semantics, reconciliation, or authoritative production writes.

### vvs-ops-mini
- systematic-debugging
- risk-aware-testing
- adversarial-review
- vercel-react-best-practices
- ui-ux-pro-max

Preserve the authority boundary: Telegram/Mini App -> Apps Script -> Google Sheets. The frontend must not become a second accounting, custody, sales, authorization, or operational source-of-truth engine.

### nextjs-supabase
- systematic-debugging
- risk-aware-testing
- adversarial-review
- vercel-react-best-practices
- ui-ux-pro-max when UI work is in scope

CONTROLLED triggers include RLS/policies, migrations, RPCs, auth/session, tenant-scoped reads/writes, financial state, and production repair/reconciliation.

### nextjs-appscript
- systematic-debugging
- risk-aware-testing
- adversarial-review
- vercel-react-best-practices
- ui-ux-pro-max when UI work is in scope

CONTROLLED triggers include write actions, retry/idempotency, reconciliation, money/custody, identity/session routing, and Apps Script action-contract changes.

## Skill authority

Reusable skills advise execution. They never override project AGENTS.md, contracts, business rules, data ownership, authorization boundaries, or release gates.

