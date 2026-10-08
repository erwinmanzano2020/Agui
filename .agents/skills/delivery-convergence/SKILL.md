---
name: delivery-convergence
description: Apply when starting or continuing AI-assisted software projects, planning milestones, delegating coding to Codex, reviewing pull requests, handling repeated findings, or responding to "continue". Prevent tiny-step handoffs and endless review loops while respecting high-risk deployment approvals.
---

# Delivery Convergence

## One user request = one meaningful bounded work unit
When the owner says "continue", reconstruct exact repo/PR/control-center status, select the next **authorized milestone outcome**, then execute all safe dependent steps available in this turn. Do not end after a mere status poll, trivial documentation edit or repeated checkpoint if an authorized substantive action remains.

Do not pretend work can proceed after the response. If blocked by an external task, use available parallel work to create durable acceptance evidence, or stop with a clear dependency and next trigger, not "continue to continue".

## Risk and authorization
Inherit project AGENTS.md, owner decisions, data and release gates. NEVER interpret autonomous progress as permission for production writes, destructive changes, money movement, unapproved merges or irreversible deployment. Separate planning approval, implementation authorization, controlled UAT, and release promotion.

## Convergence method
1. Name the milestone's **user-visible capability**, canonical source and exit criterion.
2. Batch source inventory and architecture risks BEFORE filing a planning PR; inspect existing live writers, consumers, recovery hooks, hidden shadowed definitions, and shared data authority.
3. Produce one consolidated plan with explicit decisions, assumptions, invariants, state transitions, fail-closed cases, affected callers, and tests. Separate *design proof* from *runtime/integration proof*.
4. Run one internal adversarial/refutation pass organized by failure families; fix related problems as one batch rather than one commit per observation.
5. For STANDARD or CONTROLLED work (and FAST only when a concrete material risk warrants it), request one independent review on a frozen exact head. FAST low-risk copy/prototypes normally stop after a smoke check. Treat comments as hypotheses to prove/refute using source and tests; don't treat P1 label as unquestionable.
6. Triage survivors into: PLAN_DEFECT (must fix now); RUNTIME_ACCEPTANCE (specific future executable test); EXTERNAL_DEPENDENCY (decision, access, real-world UAT); FALSE_POSITIVE (explain evidence). A genuine security or financial blocker cannot be downgraded merely to satisfy budget.
7. Apply ONE consolidated correction batch and run regression. Fresh review only if core contract changed or credible material uncertainty remains.
8. Issue a gate decision: READY FOR APPROVAL, BLOCKED WITH ONE RECOMMENDED DECISION, or AUTHORIZED NEXT GATE. Open high-severity findings are never silently closed.
9. Keep exact-head CI and review truth; CI green is not domain proof. Preserve production invariants and no-write boundaries.

## Loop circuit breakers
- If two consecutive turns only add planning notes or status without moving an exit criterion: stop the pattern, consolidate duplicated documents, state the actual blocking evidence, and perform one substantive action.
- If reviewers keep discovering new failure families: stop asking for more review; run a **single cross-system dependency audit**, then freeze a revised contract. This is a risk investigation, not a license to skip verification.
- Don't change the reviewed head while an exact-head review is pending unless a safety-critical defect requires an explicit review reset.
- Review-budget exhaustion does NOT permit shipping known unsafe code. It requires a bounded decision or redesigned scope.
- Preserve independently approved finished gates. Never reopen completed UAT to manufacture progress.
- Update the control center at milestones/real blockers, not for each tiny edit. Avoid log spam.
- Owner report: outcome achieved, evidence, decision (if needed), next authorized action. Don't ask owner to type continue to run machine-doable steps.

## New-project inheritance
Use this skill from the beginning of new-project bootstrap. Put exit criteria, review budget, and escalation policy in the project's AGENTS.md/manifest. Keep this skill reusable; put project-specific cash, tenancy, HR or POS rules in the project itself.
