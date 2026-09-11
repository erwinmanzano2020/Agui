# Agui Development Operating Principles

## Purpose

These Operating Principles are Agui's repository-canonical execution constitution. They govern how Agui is built, how decisions are made, and how ideas, bugs, risks, discoveries, and development work are handled.

## Core Philosophy

- Clarity beats speed.
- Stability beats cleverness.
- Foundations come before features.
- Progress is phase-based, not impulse-based.
- Documentation is part of the feature.

## Hierarchy of Truth

When authorities conflict, apply this order:

1. Agui Development Operating Principles
2. Agui Roadmap
3. Master Plans
4. Codex Tasks
5. Implementation details

Stop and surface a conflict rather than allowing a lower authority to silently override a higher one.

## Phase-Based Execution

- Work one active phase at a time.
- Work only on the current active phase.
- Do not jump between features or phases.
- Do not partially implement future work “just to test.”
- Park future ideas in the appropriate plan or log, then return to authorized work.

The priority order is:

1. HR
2. POS
3. Operations
4. Finance
5. Growth & Advanced Systems

The Roadmap defines current execution state. These principles define the durable sequencing discipline and must not be used to infer that a phase is active.

## Mandatory Idea/Bug/Risk Flow

Every idea, bug, risk, or discovery follows the same flow:

**Acknowledge → Classify → Place → Log → Return to current work.**

Acknowledge the item, classify its urgency and governing phase, place it in the correct plan or backlog, log the durable context needed to recover it, and return to the currently authorized work. Discovery alone is not implementation authorization.

## Identity/Data Rules

- One Person/Entity may have multiple phone numbers, email addresses, and other identifiers.
- Identifiers are weak signals, not proof of uniqueness.
- Use lookup-first flows before creating identity records.
- Reuse identities only when the approved evidence and boundaries support doing so safely.
- Handle ambiguous matches and conflicts explicitly.
- Never assume phone number or email equals a unique person.
- Never auto-merge identities.
- Shared identifiers are legitimate and must remain representable.
- Preserve tenancy, authorization, privacy, and approved contract boundaries in every identity or data operation.

## Codex Responsibilities

Codex must:

- follow the hierarchy of truth and current phase authorization;
- follow applicable lower-level technical governance documents and local `AGENTS.md` files within their scope;
- for DB/API/RPC work, follow `agui-starter/docs/db-api-access-guidelines.md` and applicable migration instructions;
- update repository documentation when work introduces patterns, limitations, or workarounds;
- surface bugs, risks, contradictions, and boundary concerns;
- stop and ask when scope or authority is unclear.

Codex must not:

- invent architecture or policy;
- skip required documentation;
- solve future problems early;
- override tenancy, security, authorization, or identity rules.

## Documentation Is Part of the Feature

Behavior, assumptions, and limitations must be documented in the appropriate canonical repository location. A change is incomplete when its operation, boundaries, or known constraints cannot be recovered from durable project documentation.

## Compliance

Deviations from these principles must be explicit, logged in the appropriate durable record, and approved by the owner or other governing authority. Silence, convenience, or an implementation detail does not constitute an exception.

## Living Document

These principles may evolve, but changes must be intentional, logged, and communicated. Supporting documents may add detail within their scope; they may not create competing authority or silently weaken this constitution.
