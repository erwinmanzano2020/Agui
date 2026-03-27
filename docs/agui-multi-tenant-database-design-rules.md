# Agui Multi-Tenant Database Design Rules (v1)

## Purpose

This document defines the database design rules Agui must follow to remain scalable, migration-safe, and authorization-safe.

It aligns database structure with:

- organizational glossary
- hierarchy and authority rules
- access/authorization model

This is a canonical reference for all schema decisions.

---

## Core Principle

Every record must have an unambiguous home.

For every row:

- which scope owns it?
- what layer does it live in?
- what contains it?

If this is unclear, the schema is incorrect.

---

## 1. Structural Hierarchy Must Be Explicit

Agui must use explicit structural tables:

- guilds
- houses
- branches
- devices

Avoid polymorphic “organization” tables.

Containment must be represented explicitly via foreign keys or validated relationships.

---

## 2. Canonical Ownership Rule (Critical)

Every operational table must have a clearly defined owning scope.

Examples:

- employees → house_id
- payroll_runs → house_id
- sales → house_id + branch_id
- device_sessions → device_id + branch_id + house_id

Ownership must NOT depend on deep joins.

If ownership cannot be determined directly from the row, the schema is incorrect.

---

## 3. Prefer Explicit Scope Columns

Avoid deep inference like:

device_sessions → device → branch → house

Instead:

device_sessions.house_id must exist when needed for safe access, filtering, and reporting.

Denormalization is allowed when it improves:

- authorization safety
- query clarity
- operational reliability

---

## 4. Scope Is First-Class

Supported scopes:

- platform
- guild
- house
- branch
- device

All important business records must map cleanly to a scope.

Do not rely on implicit scope inference in application logic.

---

## 5. Separate Identity From Membership

Do NOT store tenant or role directly on users.

Avoid:

users.house_id
users.role

Use normalized structures:

role_assignments:

- entity_id
- role_key
- scope_type
- scope_id

This supports multi-scope membership and flexible authorization.

---

## 6. Do Not Overload Tables

Avoid generic tables like:

organizations(type = guild | house | branch)

Use explicit tables for each layer.

If layers have different meaning, they must have different tables.

---

## 7. Separate Configuration From Business Data

Use dedicated tables:

- guild_settings
- house_settings
- branch_settings

Do NOT mix:

- branding
- defaults
- feature flags
- policy templates

into transactional tables.

---

## 8. Columns Must Be Single-Purpose

Do not reuse columns for evolving meanings.

Bad:
house_id used for tenant → later billing → later reporting scope

Good:
add new columns for new meanings.

Each column must have a stable, single responsibility.

---

## 9. Favor Clarity Over Perfect Normalization

Agui prioritizes:

- clarity
- authorization safety
- migration safety

over theoretical normalization.

Explicit ownership and scope are more important than minimal duplication.

---

## 10. Hierarchy Does Not Define Authority

The database models containment, not permission.

Authority is defined by:

- roles
- permissions
- policies

Do not encode authorization assumptions into schema structure alone.

---

## 11. Authorization-Safe Schema

Tables must support direct filtering by scope:

- house_id
- branch_id
- scope

Authorization checks must not require fragile multi-hop joins.

---

## 12. Migration-Friendly Design

Schema evolution must be additive.

Prefer:

- adding columns
- adding tables
- backfilling data

Avoid:

- repurposing columns
- silent meaning changes

---

## 13. Rules Summary

Agui database design must follow:

1. Every record has a clear owner
2. Structural hierarchy is explicit
3. Ownership must be directly queryable
4. Scope must be explicit
5. Identity and membership are separate
6. Tables must not be overloaded
7. Config must be separate from business data
8. Columns must be single-purpose
9. Clarity over perfect normalization
10. Hierarchy ≠ authority
11. Schema must support safe authorization
12. Schema must evolve safely

---

## Status

Version: v1
Scope: HR-first architecture foundation
Type: Canonical database design rules
