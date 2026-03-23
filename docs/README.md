# Agui Docs Index

- Core
  - [Vision](./agui/001-vision.md)
  - [Agui Development Operating Principles](../agui-development-operating-principles.md)
  - [Authorization Foundation (HR-first)](./agui-authorization-foundation.md)
  - [Agui Organizational Glossary](./agui-organizational-glossary.md)
  - [Agui Hierarchy and Authority Rules](./agui-hierarchy-and-authority-rules.md)
  - [Agui Multi-Tenant Database Design Rules](./agui-multi-tenant-database-design-rules.md)
  - [HR Branch Scope Model](./hr-branch-scope-model.md)
  - [HR Branch Scope Enforcement Plan](./hr-branch-scope-enforcement-plan.md)
- HR
  - [HR Master Plan](./hr/hr-master-plan.md)
  - [HR Scoped Authorization Model](./hr/hr-scoped-authorization-model.md)
  - [HR Role System Model](./hr/hr-role-system-model.md)
  - [HR Deny UX Rules](./hr/hr-deny-ux-rules.md)
  - [HR Employee Branch Assignment Rules](./hr/hr-employee-branch-assignment-rules.md)
  - [HR-1 Implementation Runbook](./hr/hr-1-implementation-runbook.md)
  - [HR-2.3 Freeze Declaration](./hr/hr-2-3-freeze.md)
  - [HR-3.3 Freeze Declaration](./hr/hr-3-3-freeze.md)
  - [HR-3.4.2 Freeze — Run PDF Export (Merged)](./hr/hr-3-4-2-freeze.md)
  - [HR-3.4.2c Timestamp Fix Notes](./hr/hr-3-4-2c-timestamp-fix.md)
  - [HR-3.5.1 Kiosk Devices Admin](./hr/hr-3-5-1-kiosk-devices.md)
  - [HR-3.5.1a Kiosk Setup Wizard](./hr/hr-3-5-1a-kiosk-setup-wizard.md)
  - [HR-3.5.2 Employee ID Cards](./hr/hr-3-5-2-employee-id-cards.md)
  - [HR-3.5.2 Freeze Declaration](./hr/hr-3-5-2-freeze.md)
- Admin
  - [HR DTR Timezone Repair](./admin/hr-dtr-timezone-repair.md)
- Engineering
  - [Agui Codex Review Kit](./engineering/agui-codex-review-kit.md)
  - [Supabase / Migrations Hygiene](./db/supabase-migrations-hygiene.md)
  - [Debugging Playbook](./engineering/debugging-playbook.md)
  - [New Chat Handoff](./engineering/new-chat-handoff.md)

## Root-level checks
Root-level npm scripts proxy to `agui-starter`, so developers and automation can safely run lint, typecheck, test, and build from the repo root.
