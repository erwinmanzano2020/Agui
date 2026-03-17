Agui Organizational Glossary (v1)

Purpose

This document defines the canonical meaning of core Agui concepts.

All architecture, database design, and authorization logic must align with these definitions.

If a term is used differently in code or other docs, this document is the source of truth.

---

Core Concepts

Platform

The top-level system that hosts all tenants, modules, and capabilities.

- Global scope
- Not tied to any specific guild or house
- Used for system-wide roles (e.g., game_master)

---

Guild

A grouping layer above houses.

Used for:

- multi-brand organizations
- shared configuration across houses
- cross-house reporting

A guild may contain multiple houses.

---

House

The primary tenant boundary for business operations.

Represents:

- a company
- a brand
- a business unit

Most operational data belongs to a house.

Examples:

- employees
- payroll
- HR policies
- house-level settings

---

Branch

A physical or logical subdivision of a house.

Represents:

- store location
- operational unit

Used for:

- POS operations
- attendance tracking
- localized reporting

A branch always belongs to a house.

---

Device

A physical or virtual device operating within a branch.

Examples:

- POS terminal
- kiosk
- tablet

Used for:

- device sessions
- POS transactions
- device-level operations

A device belongs to a branch.

---

Identity & Actors

User

A person who can log into the system.

- Has authentication credentials
- May belong to multiple houses/guilds
- May have different roles per scope

---

Entity

An internal system representation of an actor.

- Used for authorization
- Can represent a user or system actor
- Linked to roles and permissions

---

Employee

A business-domain record within a house.

- Belongs to a house
- May be linked to a user
- Used for HR, payroll, attendance

Important:
An employee is NOT the same as a user.

---

Authorization Concepts

Scope

The level at which an action or permission applies.

Supported scopes:

- platform
- guild
- house
- branch
- device

---

Role

A named grouping of permissions assigned at a scope.

Examples:

- house_owner
- house_manager
- cashier

Roles do not automatically imply cross-scope authority.

---

Permission

A specific allowed action.

Examples:

- employee.read
- payroll.run
- inventory.adjust

Permissions are evaluated at runtime.

---

Policy

A rule or set of rules that determines whether an action is allowed.

Policies may consider:

- roles
- permissions
- scope
- context

---

Membership

Represents whether an entity belongs to a scope.

Examples:

- user is a member of house A
- user is not a member of house B

Membership is required before most actions are allowed.

---

Key Distinctions

User vs Employee

User:

- system identity
- can log in

Employee:

- business record
- tied to HR domain

A user may or may not be an employee.

---

Role vs Permission

Role:

- grouping of permissions

Permission:

- specific action

---

Scope vs Ownership

Scope:

- where an action applies

Ownership:

- which scope owns a record

These are related but not identical.

---

Hierarchy vs Authority

Hierarchy:

- defines containment (guild → house → branch)

Authority:

- defines what actions are allowed

Being higher in hierarchy does NOT automatically grant full authority.

---

Rules

1. All modules must use these terms consistently.
2. No module should redefine these concepts differently.
3. New terms must be added here before being used widely.
4. Authorization logic must align with these definitions.

---

Status

Version: v1
Scope: HR-first architecture foundation
Type: Canonical reference document
---
