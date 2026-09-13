# Agui Platform Architecture

## 1. Purpose

This document records the durable conceptual model for Agui: **one integrated
business platform with multiple bounded first-party business modules and multiple
possible client surfaces**. In short: **one Agui system, multiple front doors**.

This is an architecture clarification, not a runtime design. “Agui Core” below
names a conceptual shared foundation; it does not declare or require a new code
package, service, deployment unit, or repository reorganization.

## 2. Architectural Model

Agui is neither one undifferentiated application nor a collection of unrelated
business systems. Its intended model is:

> one Agui platform with multiple bounded business modules

A business module owns a coherent capability. A surface/client presents some of
that capability to a user or device. One module may have multiple specialized
surfaces, and no module is required to support every surface type.

Conceptually:

```text
Agui Platform / Core
  ├─ shared identity, tenancy, authorization, contracts, and services
  └─ first-party business modules
       ├─ HR
       ├─ POS
       ├─ Operations (inventory, purchasing, and stock-flow foundations)
       ├─ Finance
       └─ Growth / advanced systems

Business modules
  └─ authorized module contracts / APIs
       └─ surfaces (Web/PWA, native clients, Telegram, Mini Apps, ...)
```

The arrows describe architectural relationships, not currently implemented APIs
or authorization to build any named module or surface.

## 3. Agui Platform / Core

The **Agui Platform** is the integrated whole. **Agui Core** is the conceptual
name for shared foundations used across modules. Depending on approved product
needs, those foundations may include the identity/entity model, tenant and
organizational scopes, houses and branches, authentication, authorization and
permissions, shared data contracts, audit/event foundations, common API and
integration contracts, configuration, and platform-level services.

Current non-negotiable boundaries remain in force: House is the tenant boundary;
Branch is a location construct rather than a tenant replacement; Workspace is a
UI-only concept; and identity is shared foundational infrastructure that must not
be reduced to weak identifiers or silently merged. This document adds no runtime
guarantee to those already established by the [Operating Principles](../../agui-development-operating-principles.md)
and governing module contracts.

## 4. First-Party Business Modules

An **Agui Module** is a bounded business capability inside Agui. The canonical
Roadmap-level sequence is **HR → POS → Operations → Finance → Growth / advanced
systems**. Operations owns inventory, purchasing, and stock-flow foundations;
Inventory and Purchasing are not independent peer modules unless a future
approved Roadmap decision changes that ownership. Finance owns settlement,
accounting, and ledger-facing foundations. A module may own domain logic,
workflows, UI, permissions, and contracts while consuming shared platform
foundations.

The boundary supports cohesion without separation into unrelated systems.
Cross-module dependencies must remain explicit and phase-gated; calling a domain
a module does not activate it, reorder the Roadmap, or grant implementation
authority.

## 5. Small-Business and Organization-Size Neutrality

Agui should be organization-size neutral: usable by a solo operator or family
business with overlapping responsibilities while able to scale toward a
multi-person, multi-branch, and more formally departmentalized organization. A
module represents a business capability, not a requirement for a corresponding
department or dedicated employee. Using HR does not require an HR department;
using Finance does not require a Finance department; and using Operations does
not require an Operations team.

> **Agui should organize the work even when the business does not yet have people
> dedicated to each kind of work.**

One authorized person may legitimately perform multiple responsibilities within
the appropriate scope:

> Person → multiple responsibilities → authorized Agui capabilities

This is not a one-module → one-department → one-employee model. Capabilities
should be progressively adoptable without requiring enterprise-like structure
before they provide value. As a solo or owner-operated business, family business,
small team, or growing operation becomes more specialized, it may redistribute
responsibilities among more people without rebuilding the underlying Agui
business processes. Organizational complexity should appear only when needed.
Existing role, permission, tenancy, and action-authorization contracts remain
authoritative; this principle defines no new authorization behavior.

## 6. 80/20 Value and Interaction Simplicity

Agui's **80/20 value principle** is a design heuristic, not a measured ratio or
service-level guarantee: a relatively small amount of correct operational input
should produce disproportionately useful organization, visibility,
accountability, control, confidence, and decision support. Agui should amplify
work users already perform rather than create another administrative burden.

Users may be busy, interrupted, serving customers, switching among cashiering,
receiving, ordering, inventory, approvals, deliveries, customer assistance, and
administration, and may not be specialists in the domain or technology. Agui
should absorb operational complexity where it can do so safely instead of
transferring that complexity into the operator's memory. Durable interaction
preferences are obvious next actions, minimal necessary input, reuse or safe
prefilling of reliably known information, sensible defaults, progressive
disclosure, immediate confirmation, clear pending/completed/error states,
appropriate recoverability, duplication prevention, task-appropriate terminology,
and safe automation of derived or repetitive work.

Low friction must not weaken authentication, tenancy, authorization, action
permissions, auditability, applicable approvals, financial correctness, identity
integrity, frozen contracts, evidence, or accountability. The model is **simple
surface, rigorous underlying system**: an interaction may be simple while Agui
performs necessary scope, identity, authorization, attribution, audit, and
contract enforcement beneath it.

These are owner-approved long-term product/architecture principles, not claims of
complete current behavior or authorization for UX implementation. Detailed
patterns, metrics, component behavior, and module-specific UX require separately
authorized work.

## 7. Client and Surface Model

A **surface/client** is a way to interact with an authorized capability; it is
not another copy of the module. Examples illustrate the model, not commitments:

- HR could be reached through the current Web/PWA management experience and,
  after separate authorization, a dedicated DTR/kiosk native client, Telegram
  interactions, Mini App workflows, or other employee-facing clients.
- POS has web surfaces in the current repository and could, only after a future
  explicit phase decision, have a native cashier client, Telegram alerts or
  assisted actions, or other operational interfaces.

Each surface exposes only the workflows appropriate to it. Neither this model nor
the presence of an example requires every module to have every kind of surface.

## 8. Native Applications

A **Native Client** is not a separate business system and is not automatically a
separate module. It is a specialized Agui client for workflows that materially
benefit from native capabilities—for example barcode/scanner access, receipt
printers, cash drawers, weighing scales, fingerprint/NFC or kiosk hardware,
dedicated kiosk behavior, temporary disconnected operation, or high-speed
frontline interaction.

These are architectural examples only. No native application is authorized here,
and no choice is made among mobile, desktop, or platform-specific technologies.
Technology selection requires a later, explicitly authorized decision.

## 9. Shared Business Logic and Contracts

Clients must not independently redefine canonical business rules. The intended
direction is to define a business rule once at the appropriate platform or module
contract boundary, then consume that rule through authorized clients wherever
practical. PWA, native, Telegram, Mini App, and other experiences should therefore
produce consistent domain outcomes.

For example, future native, web, and Telegram-assisted POS surfaces must not each
invent different pricing rules. HR clients must not keep competing copies of
attendance or payroll rules. This is a long-term guardrail; it is not a claim
that every current rule is already centralized or exposed through a shared API.

## 10. Offline-Capable Clients

A future offline-capable native client may need operational local state such as a
cache, pending transactions, synchronization queues, or device-local state for
temporary disconnection. Such state does not create a second independent source
of business truth. It must eventually reconcile through Agui's canonical platform
and module contracts.

Conflict handling, reconciliation, durability, synchronization, and offline
authorization require separate explicit design and approval before implementation.
This document defines no synchronization protocol and authorizes no offline work,
including no POS offline work.

## 11. Telegram and Mini Apps

Telegram and Telegram Mini Apps are additional Agui interaction surfaces, not
parallel business systems. Subject to separate authorization, Telegram could
provide conversational guidance, notifications, commands, approvals, or workflow
launching; a Mini App could provide structured forms and workflows; and deep links
could open the appropriate Agui workflow. These surfaces should consume the same
authorized module capabilities and canonical rules as other clients.

No Telegram, Mini App, or deep-link implementation is authorized by this document.

## 12. Module Enablement vs Authorization

Showing, hiding, enabling, or discovering a module is not authorization to perform
its business actions. The following remain separate concerns:

- module availability and UI discovery;
- tenant and organizational scope;
- role and permission enforcement; and
- read/write authorization at the applicable contract and data boundary.

Every client must preserve existing authorization, no-leak, and House-tenancy
rules. A UI toggle or visible route must never substitute for server/data-layer
enforcement.

## 13. Plugin Boundary

- **Module:** a bounded business capability inside Agui.
- **Plugin/Extension:** an independently packaged or installable extension that
  targets a stable plugin/extension contract.

Agui currently follows a **core + first-party modules** model. The repository does
not currently establish, require, or promise a WordPress-style or marketplace-style
plugin architecture. A third-party extension system may be evaluated only if a
real product requirement and separate approval emerge. This document neither
designs nor authorizes a plugin SDK.

## 14. Current State vs Intended Direction

### Current repository/platform reality

- The repository contains one integrated application codebase in which Team,
  Shifts, Payroll, POS, Settings, and other app entries are centrally represented.
- Shared authentication, permission/feature-guard, identity, tenant-scope, and
  configuration infrastructure exists, with behavior constrained by its current
  approved contracts.
- Current business capabilities are first-party parts of Agui, not independently
  installable plugins targeting a stable third-party extension contract.
- The [Roadmap](../../agui-starter/docs/Agui%20Roadmap%20Plan.md) makes HR the sole
  active phase and preserves POS as paused at the merged PR #488 checkpoint.

These facts describe repository organization and governance; they do not claim
that every desired shared contract, module boundary, surface, or deployment model
has already been completed.

### Intended architectural direction

- First-party domains become increasingly well-bounded Agui Modules while sharing
  platform foundations.
- Agui remains organization-size neutral: capabilities can be adopted
  progressively as people, responsibilities, branches, and operational
  sophistication evolve, without requiring formal departments.
- The 80/20 value, low-cognitive-load, real-world-operating, and simple-surface /
  rigorous-system principles guide future product and UX decisions; they are not
  claims that the current product already fulfills every aspect.
- Module/platform contracts are reused across clients so business logic does not
  fork by surface.
- Specialized native clients may be considered where operational needs justify
  them, subject to explicit approval and technology selection.
- Telegram and Mini Apps may become additional front doors to authorized module
  capabilities.
- A plugin/extension architecture remains optional future scope and exists only
  after a separately approved product and contract decision.

## 15. Governance / Non-Authorization Boundary

> This document records long-term architecture direction only. It does not
> authorize implementation of a module, client, native application, offline-sync
> mechanism, hardware integration, Telegram/Mini App or UX work, schema/API or
> migration change, refactor, technology selection, or runtime work.
> Active work remains controlled by the canonical Roadmap, module status
> documents, approval gates, and explicit owner authorization.

The active phase remains HR under the [canonical Roadmap](../../agui-starter/docs/Agui%20Roadmap%20Plan.md).
POS remains paused at the preserved POS-F3 Slice 12 Tender Intent runtime checkpoint;
its frozen contracts and existing runtime remain untouched. Native POS, POS
offline/synchronization, and POS hardware work remain unauthorized unless a future
explicit owner-approved Roadmap/phase decision reactivates POS. Operations,
Finance, Growth, and other future work remain gated according to canonical
governance.
