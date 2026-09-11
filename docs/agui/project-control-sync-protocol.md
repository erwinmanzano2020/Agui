# Agui Project Control ↔ Repo Knowledge Relay / Sync Protocol

**Status:** Active Process Protocol
**Authority:** Subordinate to Agui Development Operating Principles, Roadmap, and applicable Master Plans
**Owner Decision:** DEC-011
**Version:** 1

## 1. Purpose

This protocol reduces cross-chat drift and reliance on conversational memory, makes bounded-task bootstrap deterministic, preserves one hierarchy of truth, and keeps operational status discoverable. A fresh session must be able to recover from durable sources without reading a previous conversation.

## 2. Authority Model

The canonical hierarchy remains:

1. Agui Development Operating Principles;
2. Agui Roadmap;
3. Master Plans;
4. Codex Tasks; and
5. implementation details.

Within that hierarchy:

- **Repository governing documents and code on the governing branch** are durable canonical project truth.
- **Hosted GitHub** is authoritative execution evidence for PR identity, exact hosted head and diff, changed files, reviews, checks/CI, merge status, merge commit, and current hosted branch state. A local SHA is not automatically proof of the hosted PR head.
- **Agui Project Control Center** is an operational mirror, map, discovery index, and continuity checkpoint. It does not override repository authority.
- **Chat and conversational memory** are working context only. An explicit owner instruction can authorize bounded work, but durable ongoing project state must be reflected in the appropriate repository documentation before contributors rely on it as canonical.
- **Sync Map** is a navigation and reconciliation aid, not an authority layer.

## 3. What the Project Control Center Is For

The Project Control Center may summarize the dashboard, queue, module status, documentation index, decisions, naming, guardrails, PR lifecycle, risks and gaps, sources, change log, future capabilities, and Sync Map. It helps humans and agents locate canonical repository sources; it is not bound here to any external identifier.

## 4. What the Project Control Center Is Not

It is not a replacement for the Roadmap or Master Plans, a schema registry, a runtime configuration source, an authorization database, proof that a PR merged, or proof that a hosted review passed.

## 5. Bootstrap Procedure

For every bounded Codex task:

A. Identify the active phase.
B. Read root and closest applicable nested `AGENTS.md` instructions.
C. Read the Agui Development Operating Principles.
D. Read the current Roadmap.
E. Read the relevant active Master Plan and status.
F. Read relevant decision, approval, gate, and contract records.
G. Read mapped implementation surfaces when implementation is authorized.
H. Identify the bounded scope and stop conditions.
I. Compare the task instruction with governing authority.

Only task-relevant sources need deep reading; the whole repository is not required. If a conflict exists, **stop and surface it**.

Fresh-session recovery follows:

```text
AGENTS
  ↓
Operating Principles
  ↓
Roadmap
  ↓
Active Master Plan / Status
  ↓
Relevant Approval / Contract
  ↓
Sync Protocol / Sync Map
  ↓
Mapped code
  ↓
Bounded task
```

## 6. During-Work Documentation Rule

Documentation remains part of the feature. Reflect a new pattern, behavior, contract clarification, limitation, workaround, material risk, authorization boundary, tenancy or identity implication, or operational edge case in the appropriate repository documentation in the same PR when required. Do not defer known required cleanup indefinitely. Log or park future ideas without derailing or expanding active work.

## 7. Completion Handoff

Work with material project-control impact must provide the Control Center Sync Payload defined in the [contributor process guide](../../agui-starter/docs/agui-dev-process-codex-guidelines.md#control-center-sync-payload).

Classify payload information accurately:

- **Local/unverified:** working-tree observations and local completion SHA until hosted comparison.
- **Hosted/verified:** exact hosted PR, head, diff, review, CI, and merge evidence independently checked on GitHub.
- **Proposed:** recommendations or undecided future state; not canonical approval.
- **Canonical:** governing repository documents/code on the governing branch.

The payload is a handoff; it does not itself update the Project Control Center.

Material mirror triggers are phase changes, milestone/gate changes, owner decisions, contract approvals/changes, PR opening, material review findings, blockers, new P1/P2 risks, merge-ready state, merges, important limitations, and future-capability discoveries that must be parked. Trivial formatting, typo-only changes, and routine internal details without project-control value do not require mirror updates. This aligns with DEC-006 continuity discipline.

## 8. Hosted Verification Procedure

After Codex completion, ChatGPT/owner verifies the exact PR, exact hosted head, changed-file list, current diff, reviews/comments, checks/CI, applicable deployment evidence, and mergeability. After an owner merge, verify the merge commit. Advance material Project Control Center status only from this hosted evidence. Codex must not claim hosted verification it could not perform.

Codex may prepare a branch, commit, create or update a PR, and report completion. Unless explicitly authorized, Codex must not trigger `@codex` review, merge, enable auto-merge, resolve owner/reviewer threads, or recommend merge based only on local results. The owner controls the manual review trigger, and exact-head verification precedes a merge recommendation.

## 9. Reconciliation Rule

When the Project Control Center and repository appear to disagree, do not select the convenient claim. Mark the status **Needs Reconciliation**, then:

1. identify the conflicting claims;
2. identify the governing repository authority;
3. determine whether the Project Control Center is stale or the repository lacks an approved update;
4. resolve through the normal approved documentation/PR process; and
5. resume dependent work only after ambiguity is removed.

The Project Control Center must never silently override a governing repository document. A stale mirror must not block otherwise authorized work after governing repository truth is verified; correct the mirror.

## 10. Sync Map

The planned external Project Control Center Sync Map maps operational concerns to canonical repository sources and update triggers. Its fields should be equivalent to:

- Sync ID;
- Concern / Area;
- PCC Tab;
- Canonical Repo Source(s);
- Supporting Code / Runtime;
- Read Trigger;
- Update Trigger;
- Codex Required Action;
- ChatGPT Mirror Action;
- Verification; and
- Notes.

The Sync Map remains operational metadata and must not become a Markdown copy of every Project Control Center row or an additional authority layer.

## 11. Security / Privacy

Do not place private Project Control Center identifiers or URLs, secrets, credentials, personal account identifiers, or private connector metadata in the public repository. Repository documentation may refer generically to the **Agui Project Control Center**.

## 12. V1 Limitations

Synchronization is manual and auditable. V1 has no automatic webhook, bot, writer, integration, or background synchronization. The Project Control Center can become stale, hosted verification remains required, and this protocol cannot guarantee memory across chat systems. It instead provides deterministic recovery from durable sources.

## 13. Future Automation

An automated relay or synchronization mechanism may be considered only with separate explicit approval and security design. V1 neither authorizes nor designs that automation.
