---
name: ai-development-system
description: Bootstrap and continue software projects using the AI Magic development system. Use when starting a project, resuming an existing project from its Project Control Center and repository, or coordinating implementation, review, UAT, and release without making the owner manually shuttle between ChatGPT, Codex, GitHub, and prior chat history.
---

# AI Development System

Use this skill as the orchestration layer for project work.

Project-specific governance always outranks this skill and every reusable skill.

## Operating model

**Use ChatGPT Work as the default shared engineering workspace when available. ChatGPT is the single owner-facing orchestrator.** The owner should not have to manage a separate back-and-forth workflow with Codex or repeatedly type "continue" after ordinary engineering checkpoints.

Roles:

- **Owner:** business intent, material product decisions, approval when governance requires it, and real-world UAT actions that cannot be automated.
- **ChatGPT:** strategy, scope/risk classification, architecture, sequencing, delegation, interpretation of evidence, PR/release decisions, durable-state maintenance, and deciding whether reviewer findings are real.
- **Codex / independent reviewer:** implementation assistance and independent code-review signal. It is a subordinate engineering tool, not the workflow conductor.
- **Tests / CI / Vercel / repository checks:** evidence sources, not decision-makers.
- **Project Control Center:** durable continuity index.

Read `references/work-mode.md` for the executable workflow, owner launcher, recovery, UAT, readiness and new-project rules. Run `node project.mjs status` when installed; do not run a live adapter merely to inspect status.
Read `references/orchestration.md` for stop/continue rules.
Read `references/external-gates.md` whenever PR checks, CI, Vercel, or independent reviews are pending.
Read `references/review-convergence.md` for CONTROLLED planning/runtime review budgets, semantic-cluster review, and re-review triggers.
Read `references/profile-selection.md` for profile/skill selection.
Read `references/control-center.md` for durable project state.

## Continue Project

1. Read project governance first. Reconstruct state from `.ai-development/state.json`, its evidence links, relevant Control Center records and current source; treat state as an index, never authorization.
2. Read the Project Control Center: Current, blocking Questions, relevant Decisions, recent Dev Log, open UAT & Bugs, latest Releases.
3. Verify root/nearest `AGENTS.md`, active milestone contracts and exact Git/PR/CI/deployment facts. Prefer local implementation and relevant tests before publishing a coherent change.
4. Form the continuation brief internally: milestone, stage, last completed action, next authorized action, blockers, active PR/branch/preview/release, risk lane, and relevant skills.
5. Resolve stale descriptive metadata against authoritative current evidence and annotate history. Escalate only unresolved material business/authority conflicts; do not make ordinary documentation drift an owner task.
6. Keep executing all authorized machine-doable work in the same run. Do not stop merely because a review was requested, CI is running, a deployment is building, or another ordinary engineering checkpoint exists.
7. While an external check is pending, perform independent work that does not depend on its result: inspect diffs, run tests, verify invariants, prepare UAT, update docs, or examine deployment/configuration state.
8. Treat Codex findings as hypotheses. Refute each against the actual contract before changing code.
9. Before ending meaningful work, update durable state so a new session can resume without pasted transcripts.

## Owner interruption rule

Interrupt the owner only when at least one of these is true:

- a genuine business/product decision has multiple materially different valid choices;
- governance explicitly requires owner approval;
- a real-world UAT step requires the owner's device/account/physical action;
- credentials, permissions, or an external service block all further authorized progress;
- a destructive/irreversible action needs confirmation;
- durable sources materially conflict and cannot be resolved from authoritative project evidence.

Do **not** interrupt merely to ask the owner to type "continue", re-send context, inspect a normal reviewer result, or approve routine fixes already authorized by the current milestone.

When owner action is required, batch it into the smallest practical number of interruptions.

## Risk lanes

### FAST
Intent check -> build -> smoke check -> keep/discard. Do not add review ceremony without a concrete reason.

### STANDARD
Concise design -> implementation -> relevant tests -> focused adversarial review when warranted -> release checks.

### CONTROLLED
Explicit invariants/contracts -> implementation -> tests -> adversarial review/refutation -> fix material survivors -> regression -> real-world UAT when needed -> release verification.

An independent Codex review is useful second-opinion evidence for CONTROLLED work, but it is **not automatically a blocking gate** unless project governance explicitly makes it one or the change materially altered a critical contract in a way not yet independently reviewed.

## Review convergence

Prefer **batched convergence**, not stop-dance loops:

1. implement a coherent change set;
2. run automated checks;
3. run one adversarial review pass;
4. refute all candidate findings;
5. fix all surviving material findings as one batch when safe;
6. run regression;
7. request or inspect one independent final review when justified by risk;
8. refute any final findings;
9. if fixes are small and fully covered by regression, close convergence without reflexively requesting another external review;
10. request another independent review only when a fix materially changes a critical contract or leaves meaningful uncertainty.

Stop when required evidence is green and there is no unresolved material failure. Reviewer silence is not required; unresolved *risk* is.

## External waits

An external wait should not become an owner task.

For short-lived external gates, actively poll the exact head/check inside the same run for a bounded window while continuing non-dependent work. If still pending and the host supports scheduled/conditional tasks, create a background watch so the owner does not need to refresh GitHub or type "continue". If background tasks are unavailable, persist the exact checkpoint and state that this is an environment limitation—not the intended owner workflow. See `references/external-gates.md`.

## New Project

For greenfield bootstrap, use the natural-language client description, create durable governance and the Project Control Center, select the smallest relevant skill set, build coherent milestones, and ask only material blocking questions. Do not invent missing business rules.

## Repository bootstrap

Run `scripts/bootstrap_project.py --dry-run` first for an existing project. Bootstrap preserves existing governance, manifests, resumes, state and skills; upgrade them only through a reviewed, explicit sync. Default skills stay minimal; add UI skills only for relevant work. Generated files never outrank project governance. Use Node 20+ for the offline workflow tools; record missing runtimes before collecting private inputs.

