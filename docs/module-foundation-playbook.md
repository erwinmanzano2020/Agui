# Module Foundation Playbook (Canonical)

## 1. Purpose
This document defines the canonical, reusable process that must be completed before implementation starts for any new Agui module (for example: POS, Operations, Finance, Growth systems).

It exists to prevent drift, preserve governing guardrails, and ensure module work does not begin with ad hoc decisions or premature coding.

This is a cross-module governance/process document only. It does not authorize feature implementation.

## 2. Scope
This playbook applies to module start-up planning and foundation definition across Agui.

In scope:
- required planning sequence
- required foundation documents
- required guardrails
- readiness checkpoint before coding

Out of scope:
- module-specific feature design
- implementation task details
- schema, API, auth, or permission redesign

## 3. When this playbook applies
Use this playbook whenever Agui is opening a new module track, including but not limited to POS, Operations, Finance, and Growth systems.

It applies before implementation tasks are created and before coding starts.

## 4. Non-negotiable principles inherited from governing docs
All module foundation work must inherit and preserve the higher-order governance documents:
- `agui-development-operating-principles.md`
- `agui-starter/docs/Agui Roadmap Plan.md`
- active module master plans and status docs
- active canonical access/identity governance docs

Mandatory inherited rules:
- follow roadmap phase priority; do not bypass active-phase discipline
- preserve house as tenant boundary
- preserve deny-by-default and no-leak behavior
- preserve identity as shared infrastructure (not module-local ownership)
- do not reinterpret frozen contracts without explicit governing approval
- additive clarification is allowed; silent semantic repurposing is not

If a conflict appears, align to higher-order authority and stop escalation of lower-order assumptions.

## 5. Canonical order for opening a new module
The following sequence is required and must be completed in order:

1. **Roadmap alignment**
   - Confirm the module is unlocked by current roadmap phase and status gating.
2. **Master plan creation**
   - Create the module master plan defining phases, boundaries, and freeze/contract intent.
3. **Status doc creation**
   - Create a canonical status/execution snapshot doc for planning and progress tracking.
4. **Domain model overview**
   - Define core entities, relationships, lifecycle states, and canonical vocabulary.
5. **Access/scope pattern**
   - Define module access resolution sequence and scope propagation model.
6. **Identity rules (if applicable)**
   - Define how module behavior uses shared identity infrastructure without redefining identity ownership.
7. **DB architecture / storage ownership doc**
   - Define storage boundaries, table ownership responsibility, and data contract surfaces.
8. **Phase-1 foundation doc**
   - Define explicit phase-1 implementation boundary, accepted assumptions, and known exclusions.
9. **Guardrails / anti-patterns**
   - Define mandatory guardrails and explicit anti-patterns for this module.
10. **Only then implementation task creation**
   - Create implementation tasks only after all prior foundation artifacts are complete and aligned.

## 6. Required documents before implementation starts
At minimum, each new module must have:
- roadmap alignment note (phase/gate confirmation)
- module master plan
- module status doc
- module domain model overview
- module access resolution pattern
- module identity interaction rules (if identity touchpoints exist)
- module DB architecture/storage ownership doc
- module phase-1 foundation doc
- module guardrails/anti-patterns doc (or explicit section in foundation docs)

If any required artifact is missing, implementation must not start.

## 7. Required guardrails that must be defined for every module
Every module foundation must explicitly define:
- tenant boundary rules
- branch/scope rules (if applicable)
- access resolution pattern
- identity ownership/reuse rules
- DB ownership boundaries
- deny-by-default / no-leak behavior
- auditability expectations
- explicit out-of-scope list

Guardrails must be written as enforceable constraints, not aspirational guidance.

## 8. What must NOT happen before foundation docs exist
Before required foundation docs are complete, the following are explicitly forbidden:
- jumping straight to UI
- creating ad hoc APIs
- designing schema in isolation
- inventing module-local identity rules
- bypassing roadmap priority
- mixing feature planning with implementation
- stealth scope expansion

## 9. Suggested minimum outputs for each new module
Minimum canonical outputs:
- one master plan document
- one status/execution document
- one domain model overview
- one access/scope pattern document
- one DB architecture/storage ownership document
- one phase-1 foundation/boundary document
- one consolidated guardrails + anti-patterns section (or standalone document)
- one implementation readiness checklist snapshot

These outputs create enough shared clarity to begin implementation safely without redefining fundamentals mid-build.

## 10. Module readiness checkpoint before coding
A module is ready for implementation only when all conditions below are true:
- roadmap gate is explicitly satisfied
- required foundation documents exist and are internally consistent
- tenancy, scope, identity, and storage boundaries are explicit
- deny/no-leak behavior expectations are explicit
- out-of-scope list is explicit
- phase-1 boundaries are explicit
- anti-patterns are documented
- implementation tasks are derived from (not preceding) the foundation set

If any condition is unresolved, return to foundation work and do not start coding.

## 11. Anti-patterns
Do not allow these module-start anti-patterns:
- contract decisions hidden in implementation tickets
- access and tenancy assumptions deferred to later “cleanup”
- identity behavior copied locally instead of using shared rules
- schema-first design without domain/access/ownership definitions
- roadmap gate reinterpretation to justify early implementation
- documentation that silently expands scope beyond approved phase

## 12. Relationship to roadmap / master plans / status docs
This playbook is subordinate to governing docs and does not replace them.

Authority relationship:
1. Development Operating Principles
2. Agui Roadmap Plan
3. Module Master Plan
4. Module Status Doc
5. This playbook as reusable module-start process

Use this playbook to standardize startup discipline; use roadmap/master/status documents to authorize and steer actual scope and sequencing.

## 13. Reusable checklist template
Use this checklist at module kickoff:

- [ ] Roadmap gate confirmed (module eligible to start)
- [ ] Master plan created
- [ ] Status doc created
- [ ] Domain model overview created
- [ ] Access/scope pattern created
- [ ] Identity interaction rules defined (if applicable)
- [ ] DB architecture/storage ownership doc created
- [ ] Phase-1 foundation boundary doc created
- [ ] Guardrails defined (tenant/scope/access/identity/DB/no-leak/auditability/out-of-scope)
- [ ] Anti-patterns documented
- [ ] Readiness checkpoint passed
- [ ] Implementation tasks created only after all above are complete

## 14. Final rule: no implementation before foundation clarity
No implementation work may begin for a new module until the required foundation artifacts are complete, aligned with governing authority, and explicitly checkpointed as ready.

When uncertainty exists, pause implementation and resolve governance/foundation clarity first.
