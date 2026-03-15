# Identity Contract

This contract captures how Agui models people and their role records, how identifiers are normalized and protected, and what operations are allowed as identities evolve.

## Principles
- **Entity vs. role records:** Represent the person/org as an `Entity`; attach house-scoped role records like `Employee`, `Customer`, or `Member` separately so one entity can hold multiple roles across houses over time.
- **Lookup-first enrollment:** Normalize every identifier input, attempt a lookup, select an existing entity and prefill safe fields; if no match, proceed to create a new entity plus the requested role record.
- **Identifier strength:** Treat phones/emails as weak and possibly shared; treat government IDs, verified IDs, or biometrics as strong. Display lookup results as “possible match” unless the identifier is both strong and verified.
- **Consistent normalization:** All reads/writes pass through the same rules (e.g., PH phones `09/9/63/+63` → canonical `+63…` E.164 while storing legacy forms when needed; emails trim + lowercase). Future identifier types get their own canonical formatters.
- **Scoped guardrails:** Block duplicate **ACTIVE** employee rows per house per entity. Allow rehire by reactivating an inactive row or creating a new active row if all prior rows are inactive.
- **Privacy by default:** Lookup APIs are house/HR-scoped, authenticated, and return masked identifiers; UIs show identity details only to authorized roles and prefer masked display unless full detail is required.
- **Identifier lifecycle as first-class:** Support add, remove (with audit/soft delete), and set-primary operations. If an identifier already belongs to another entity, do **not** auto-merge—flag for review/admin flow.
- **No borrowed identifiers:** If a person lacks a phone/email, keep emergency contact as a separate model rather than reusing someone else’s identifier. Role records may exist without personal identifiers.
- **Migrations + schema cache:** Every migration that adds/changes RPCs must include `notify pgrst, 'reload schema';` and reference the schema cache runbook.

## Identifier Strength Model
- **Weak/unverified (default):** phone numbers, emails, unverified card scans. Lookups show “possible match” and require user confirmation.
- **Stronger (verified):** government IDs validated against an authority, verified IDs, or biometrics (if ever enabled). These may be shown as “probable/likely match” but still require explicit selection.
- **Multiple identifiers per entity:** Allow storing several identifiers of mixed strength; identifiers can change or be removed over time.

## Normalization Rules (current)
- **PH phones:** Accept `09…`, `9…`, `63…`, or `+63…`; normalize to canonical `+63…`. Preserve the original input when useful for user display or audits.
- **Emails:** Trim whitespace and lowercase.
- **Extensibility:** Future identifier types (e.g., card scans, government IDs) must ship with a canonical formatter and a masking pattern before they are accepted.

## Lifecycle Operations
- **Add identifier:** Normalize, check for collisions, attach with strength metadata, and audit the action.
- **Set primary:** Promote one identifier per type as primary; update downstream caches.
- **Remove identifier:** Soft-delete or archive with audit logging; ensure lookup excludes removed rows.
- **Collision handling:** If the identifier already belongs to a different entity, block the add and route to a manual review/merge tool (never auto-merge).

## Guardrails & Privacy
- **No duplicate active employee per house:** Enforcement happens at the API layer; rehire is allowed when prior rows are inactive.
- **Masked outputs:** Use masking helpers for phones/emails in all lookup responses and list views; reveal full values only to authorized roles (e.g., GM/house manager/owner) and only when necessary.

## Operational Contract
- **PostgREST schema cache:** Migrations that add or change RPCs must end with `notify pgrst, 'reload schema';`.
- **Runbook link:** See `docs/runbooks/supabase-rls-debug.md` for diagnosing “RPC missing” or schema cache issues after deployments.
