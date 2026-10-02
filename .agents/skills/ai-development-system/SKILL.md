---
name: ai-development-system
description: Continue this repository using its Project Control Center, project governance, current Git/PR state, risk lane, and approved reusable skills instead of depending on previous chat history.
---

# AI Development System

Project-specific governance always outranks this skill.

For continuation:
1. Read the Project Control Center: Current, blocking Questions, relevant Decisions, recent Dev Log, open UAT & Bugs, latest Releases.
2. Read root and nearest local AGENTS.md, active milestone docs, relevant contracts/architecture, and current Git/PR/CI/deployment state.
3. Report current milestone, stage, last completed action, next authorized action, blockers, active PR/branch/preview/release, risk lane, and relevant skills.
4. If durable sources disagree, surface the conflict instead of guessing.
5. Continue by FAST, STANDARD, or CONTROLLED risk.
6. Before ending meaningful work, update durable state so a new chat can resume without pasted transcripts.

FAST: intent check -> build -> smoke check.
STANDARD: concise design -> implement -> relevant tests -> focused review -> release checks.
CONTROLLED: invariants/contracts -> implementation -> tests -> adversarial review/refutation -> fix survivors -> regression -> controlled UAT when needed -> release verification.

Never run endless manual review loops; use the finite adversarial-review stopping rule.
