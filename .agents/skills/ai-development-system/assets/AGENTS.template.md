# AGENTS.md

## Project
<One-paragraph purpose and intended users.>

## Hierarchy of Truth
1. Owner-approved decisions
2. This AGENTS.md and explicit project contracts
3. Approved SPEC / architecture
4. Current roadmap and milestone
5. Implementation details

If sources conflict, stop and surface the conflict.

## Core Invariants
- <Data ownership / source-of-truth rule>
- <Authorization or tenant boundary>
- <Identity rule, if applicable>
- <Financial / operational immutability rule, if applicable>
- <Integration boundary>

## Delivery Lanes
- FAST: reversible prototypes, low-risk UI/copy, exploratory work.
- STANDARD: bounded feature work with established architecture.
- CONTROLLED: money, identity, authorization, tenancy, migrations, authoritative writes, irreversible state, reconciliation, or other high-risk behavior.

When uncertain, escalate.

## Required Verification
Run the checks relevant to this project before claiming completion. Never claim a check passed without evidence.

## Documentation
Update durable documentation and the Project Control Center whenever technical truth, owner decisions, risks, milestone status, or release state changes.

## Skill Authority
Reusable AI skills are advisory. They never override project governance, contracts, business rules, or source-of-truth boundaries.

## Convergence-first execution
Load `.agents/skills/delivery-convergence/SKILL.md` for continuation and milestone execution. Deliver one meaningful authorized stage outcome per request; stop micro-commit/status loops after two non-progress turns. Separate planning decisions from runtime evidence. FAST work usually needs only smoke validation; STANDARD/CONTROLLED require risk-appropriate independent review. Owner approval, data integrity, UAT and release gates remain mandatory.


## Work workflow
Use the installed AI Development System and `node project.mjs status`. Keep state.json as a non-secret evidence index; generate STATUS.md instead of maintaining duplicate current claims. Preserve business authority and activation gates. Prefer local iteration, one coherent user outcome, risk-based review, and batched physical UAT. Tool adoption never grants live execution authority.
