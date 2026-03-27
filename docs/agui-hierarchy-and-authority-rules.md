# Agui Hierarchy and Authority Rules (v1)

## Purpose

This document defines the structural hierarchy, authority boundaries, and visibility rules for organizations inside Agui.

It ensures that hierarchy does not accidentally imply unlimited authority, and that future modules implement scope and access consistently.

Agui hierarchy:

Platform
└── Guild
    └── House
        └── Branch
            └── Device

This hierarchy defines containment, not automatic permission.

---

## Core Rule

Hierarchy defines containment.  
Authority defines what actions are allowed.

Being higher in the structural hierarchy does not automatically grant full control over all lower layers.

Authority must always be determined by:
- role
- permission
- scope
- policy

---

## 1. Structural Hierarchy

### Platform
The Agui platform itself.
Hosts all guilds, houses, modules, and infrastructure.

### Guild
A parent coordination layer above one or more houses.

### House
Agui’s primary operational tenant.

### Branch
A subdivision of a house for localized operations.

### Device
A device operating within a branch.

---

## 2. Layer Responsibilities

### Platform Responsibilities
- system administration
- support operations
- global feature management
- platform monitoring
- billing (future)
- platform templates

Platform roles do not automatically imply business ownership authority.

### Guild Responsibilities
- cross-house reporting
- shared templates
- regional/group administration
- shared configuration defaults

Guild roles may coordinate houses, but do not automatically own all house operations.

### House Responsibilities
- employees
- payroll
- attendance
- devices
- branding
- operational settings
- local policies

House is the core operating business unit.

### Branch Responsibilities
- day-to-day local operations
- shift operations
- localized reporting
- branch-assigned devices

### Device Responsibilities
- device-constrained operations
- kiosk/POS/device sessions
- branch-bound operational actions

---

## 3. Authority Rules

Authority must be scoped.

Examples:
- platform role applies at platform scope
- guild role applies at guild scope
- house role applies at house scope
- branch role applies at branch scope
- device role applies at device scope

No role should imply authority outside its scope unless explicitly granted by policy.

---

## 4. Visibility Rules

Visibility does not automatically equal modification authority.

### Platform visibility
Platform operators may view platform-wide structures as required for support and operations.

### Guild visibility
Guild-level roles may view houses within their guild, subject to policy and sensitivity constraints.

### House visibility
House-level roles may view branches, employees, and operations within their house.

### Branch visibility
Branch-level roles should generally see only branch-scoped data.

### Device visibility
Device scope should be constrained to its assigned branch and use case.

---

## 5. Modification Rules

Modification rights must be granted explicitly.

Examples:
- Guild admin may manage guild templates
- House owner may manage house operations
- Branch manager may manage branch-level workflows
- Device operator may perform device-level actions only

Structural parenthood alone must not be treated as full edit authority.

---

## 6. Inheritance Rules

Downward inheritance must be explicit and per-domain.

Examples of valid inheritance:
- guild branding defaults → house override allowed
- guild policy defaults → house override allowed
- house settings → branch-local operational overrides

Invalid assumption:
- parent scope automatically has unlimited mutation rights over all child scope data

Inheritance of defaults is different from inheritance of authority.

---

## 7. Cross-Scope Actions

Cross-scope access must be explicitly modeled.

Examples:
- guild report viewing across houses
- house-level employee management across branches
- branch device operations
- platform support access

Cross-scope actions must never rely on hierarchy alone.
They must be granted through explicit roles, permissions, and policies.

---

## 8. Rules Agui Must Follow

1. Structural containment does not equal permission.
2. Authority must always be scoped.
3. Visibility and mutation are separate concerns.
4. Inherited defaults are not inherited authority.
5. Parent scopes must not automatically gain full child-scope control.
6. Cross-scope access must be explicitly granted.
7. Modules must not invent their own hierarchy semantics.

---

## 9. Examples

### Example A — Guild Admin
May:
- view houses in guild
- manage guild templates
- view group-level reports

Does not automatically:
- finalize payroll in all houses
- edit all employees in all houses
- reset all devices in all branches

### Example B — House Owner
May:
- manage employees in house
- manage payroll in house
- manage house branches
- configure house settings

Does not automatically:
- gain platform-wide authority
- manage sibling houses in same guild unless explicitly granted

### Example C — Branch Manager
May:
- manage shifts in branch
- view branch staff
- use branch devices according to policy

Does not automatically:
- edit house-wide payroll settings
- access all branches in house

---

## 10. Status

Version: v1
Scope: HR-first architecture foundation
Type: Canonical authority and hierarchy reference
