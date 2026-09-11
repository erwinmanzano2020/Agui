# Agui Project Control ↔ Repo Knowledge Relay / Sync Protocol

## 1. Purpose

This protocol defines a deterministic, manual knowledge relay between Agui's canonical repository, hosted GitHub execution evidence, and the Agui Project Control Center. It prevents chat context, legacy copies, or operational tracking from silently displacing governing project truth.

## 2. Authority Model

The repository is canonical for durable project truth. Its governing hierarchy is:

1. Agui Development Operating Principles
2. Agui Roadmap
3. Master Plans
4. Codex Tasks
5. Implementation details

Hosted GitHub is authoritative execution evidence for PR identity, hosted head, hosted diff, reviews, CI/checks, merge state, and merge commit. The Project Control Center is an operational mirror/index. Chat is working context only. Neither the Project Control Center nor chat is co-equal with repository governing authority.

## 3. What Project Control Center Is For

The Project Control Center provides an operational index of phases, gates, work status, decisions, risks, PRs, and next authorized actions. It helps the owner and contributors find the canonical repository evidence and hosted execution evidence behind a summarized status.

Material mirror triggers are:

- phase change;
- milestone or gate change;
- owner decision;
- contract approval or change;
- PR opened;
- material review finding;
- blocker;
- new P1/P2 risk;
- merge-ready state;
- merge;
- important limitation; or
- future capability discovery that must be parked.

Trivial formatting and typo-only changes do not require a Project Control Center update.

## 4. What It Is Not

The Project Control Center is not a policy authority, code or contract source, DB/API authority, replacement for hosted review/CI, or automatic authorization to start work. A Project Control entry cannot override the governing hierarchy, expand a phase, approve a contract, or prove hosted state.

## 5. Deterministic Bootstrap Procedure

Before work, read these exact paths in order:

1. `AGENTS.md`.
2. Every applicable nested `AGENTS.md` for the surfaces in scope.
3. `agui-development-operating-principles.md`.
4. `agui-starter/docs/Agui Roadmap Plan.md`.
5. For HR work, `docs/hr/hr-master-plan.md`.
6. For HR work, `docs/hr/hr-status.md`.
7. `docs/hr/hr-master-plan-expanded.md` only where relevant, and only as a subordinate/supporting plan.
8. The exact applicable gate, approval, and devlog records.
9. Mapped code/runtime surfaces only when implementation is authorized.

Matching by filename or title alone is insufficient when compatibility or legacy copies exist. The exact canonical paths above resolve the canonical-bootstrap ambiguity identified during review of the initial DEC-011 attempt.

## 6. During-Work Documentation Rule

If authorized work introduces or discovers behavior, a limitation, workaround, risk, contract change, authorization boundary, tenancy implication, identity implication, or operational edge case, update the appropriate canonical repository documentation in the same PR when required. Classify and park out-of-scope discoveries; do not treat discovery as authorization.

## 7. Completion Handoff

For material work, produce a **Control Center Sync Payload** containing:

- Project / Phase
- Gate / Slice
- Work Class
- Status
- PR Number / URL
- Base Branch
- Expected Hosted Base SHA
- Local Completion SHA
- Hosted Head SHA
- Canonical Documents Read
- Canonical Documents Changed
- Runtime / Code Surfaces Changed
- Database / Migration Surfaces
- Authorization / Tenancy / Identity Impact
- Owner Decisions Applied
- New Decisions Proposed
- Risks / Gaps
- Tests / Checks
- Known Limitations
- Project Control Tabs To Update
- Suggested Project Control Status
- Next Authorized Action
- Scope Deviations
- Stop Conditions Encountered

The payload is a handoff record; it does not itself update the Project Control Center. A local SHA is local evidence only. A hosted head SHA requires independent hosted verification, and Codex must not claim verification it did not perform.

## 8. Hosted Verification Procedure

After a PR is hosted and before any merge recommendation:

1. Verify the PR number and URL on hosted GitHub.
2. Verify the expected base branch and hosted base relationship.
3. Verify the exact hosted head SHA rather than inferring it from a local SHA.
4. Review the hosted diff and changed-file set.
5. Review material findings and unresolved threads without resolving or dismissing them without authority.
6. Verify CI/check results and merge state.
7. Record only independently observed hosted facts in the sync payload.

Opening a PR, requesting review, resolving threads, and merging are distinct actions. Owner-controlled review and merge are preserved.

## 9. Needs Reconciliation Rule

Any material mismatch among canonical repository truth, hosted GitHub evidence, the Project Control Center mirror, or chat context is labeled **Needs Reconciliation**. Stop conclusions or actions that depend on the mismatch, identify the correct authority, reconcile the mirror or working context to it, and record any owner decision needed. Do not silently choose the most convenient version.

## 10. Sync Map Definition

A sync map connects each Project Control field to its durable source and intended destination. At minimum it records:

- canonical repository path(s) for governing decisions, status, contracts, risks, and limitations;
- hosted GitHub PR/commit/check evidence for execution state;
- the Project Control tab or field that mirrors each material item;
- the responsible manual updater and last verified point when known; and
- mismatches marked Needs Reconciliation.

The map is an index, not duplicate authority. Links and exact paths should be preferred over copied policy text.

## 11. Security / Privacy

Keep secrets and private connection material out of repository documentation and sync payloads. Do not record spreadsheet IDs, private Project Control URLs, connector IDs, API keys, secrets, tokens, credentials, or personal account identifiers. Use the generic name **Agui Project Control Center** and the minimum non-sensitive hosted or repository reference necessary.

## 12. V1 Limitations

Version 1 is manual. It includes no webhook, bot, Apps Script, GitHub Action sync, database sync, background service, or automatic Sheet writer. The payload does not prove that the Project Control Center was updated, and local repository state does not prove hosted state.

## 13. Future Automation

Any automation requires separate owner approval, an explicit security/privacy review, a defined authority-preserving failure model, and bounded implementation scope. Future automation must preserve deterministic canonical paths, hosted verification, manual reconciliation visibility, and owner-controlled review and merge.
