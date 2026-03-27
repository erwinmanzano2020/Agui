# Agui Codex Review Kit

## Purpose

This document defines the standard way Agui uses Codex for review before merge.

The goal is to make review:
- consistent
- architecture-aware
- less wasteful of Codex usage
- safer for authorization-sensitive and multi-tenant changes

GitHub `@codex review` may still be used as an extra signal, but it must not be the primary review method for important changes.

---

## Core Rule

Agui uses Codex as a structured review system, not as an ad hoc comment bot.

For important changes, review must be run through explicit review lenses before merge.

---

## Merge Gate

For any non-trivial PR, run these review lenses before merge:

1. Security and authorization
2. Multi-tenant and scope safety
3. Robustness and edge cases
4. Architecture and layering

GitHub `@codex review` is optional after these, not a replacement for them.

---

## Standard Review Prompt Template

Use this base prompt when giving Codex a diff or changed files:

```text
Review this change for Agui using these rules:

Agui rules:
- hierarchy does not imply authority
- scope must be explicit
- feature guards are not sufficient business authorization
- every record/object must have an unambiguous home
- identity, membership, role, and permission are separate concerns
- expected authorization denials must not be mistaken for backend failures
- cross-house leakage is a critical bug
- preserve current behavior unless the task explicitly changes behavior

Please review for:
1. Critical bugs
2. Security or authorization risks
3. Multi-tenant boundary violations
4. Incorrect status-code behavior
5. Architecture/layering regressions
6. Edge-case robustness issues
7. What should be fixed before merge vs later

Return:
- Blocking issues
- Non-blocking issues
- Suggested fixes
- Merge recommendation
```

---

## Focused Review Lenses

### 1. Security and Authorization Review

Use for:

- routes
- middleware
- policies
- access helpers
- uploads/downloads
- auth-sensitive services

Prompt:

```text
Review this change for security and authorization correctness.

Focus on:
- auth happening before resource-specific lookup
- 403 vs 404 leakage
- permission checks happening in the correct order
- feature guard being used incorrectly as business authorization
- same-scope / same-house ownership enforcement
- cross-tenant or cross-house leakage
- broad role presence incorrectly substituting for scoped ownership
- typed authz denial vs backend failure handling

Agui-specific rules:
- hierarchy does not imply authority
- scope must be explicit
- feature guard is not enough for business operations
- cross-house leakage is critical

Return:
1. Blocking security issues
2. Logic-ordering issues
3. Safe/unsafe behavior changes
4. Exact fixes recommended
5. Merge or do-not-merge
```

---

### 2. Multi-Tenant and Scope Review

Use for:

- schema
- queries
- storage policy
- ownership checks
- reporting filters
- migrations

Prompt:

```text
Review this change for multi-tenant and scope correctness.

Focus on:
- canonical owner scope
- direct house_id / branch_id filtering
- hidden ownership inference through joins
- branch-vs-house ambiguity
- whether every affected record/object has an unambiguous home
- whether policy/query logic respects tenant boundaries
- whether same-house ownership is actually enforced
- whether scope assumptions are explicit or accidental

Agui-specific rules:
- every record must have an unambiguous home
- scope must be explicit
- hierarchy defines containment, not authority

Return:
1. Blocking scope/tenant issues
2. Ambiguous ownership risks
3. Future migration risks
4. Recommended hardening steps
5. Merge recommendation
```

---

### 3. Robustness and Edge-Case Review

Use for:

- input validation
- parsing
- route handlers
- helpers
- migrations
- storage/path validation

Prompt:

```text
Review this change for robustness and edge-case correctness.

Focus on:
- invalid UUID handling
- malformed input handling
- whether invalid client input incorrectly causes 500
- null/undefined assumptions
- DB cast or parse failures
- regex validation holes
- case-sensitivity problems
- status-code correctness
- distinguish deny vs backend failure

Return:
1. Blocking robustness issues
2. Incorrect 4xx vs 5xx behavior
3. Test cases missing
4. Exact fixes recommended
5. Merge recommendation
```

---

### 4. Architecture and Layering Review

Use for:

- access layer
- helpers
- shared services
- domain boundaries
- new abstractions

Prompt:

```text
Review this change for architecture and layering correctness.

Focus on:
- platform vs module boundary
- access-layer responsibility boundaries
- feature guard vs business authorization boundary
- route/service/helper concerns being mixed incorrectly
- duplicated platform behavior inside a module
- whether this change increases or reduces architectural clarity
- whether it matches current Agui docs and contracts

Agui-specific rules:
- centralize shared capabilities
- decentralize business rules
- modules must not redefine platform semantics
- future migrations should become easier, not harder

Return:
1. Blocking architecture regressions
2. Layering concerns
3. Future maintainability risks
4. Safer design alternatives
5. Merge recommendation
```

---

## PR Type to Review Lens Mapping

### Auth / policy / route changes

Run:

- Security and Authorization
- Multi-Tenant and Scope
- Robustness and Edge Cases
- Architecture and Layering

### Schema / migration changes

Run:

- Multi-Tenant and Scope
- Robustness and Edge Cases
- Architecture and Layering

### UI-only changes

Run:

- Robustness and Edge Cases
- Architecture and Layering

### Storage / uploads / downloads / file access

Run:

- Security and Authorization
- Multi-Tenant and Scope
- Robustness and Edge Cases

---

## Merge Decision Rubric

Block merge if review finds:

- auth-before-lookup is missing
- tenant/scope leak
- 403/404 probing leak
- incorrect 4xx vs 5xx behavior on security-sensitive flows
- scope ambiguity that weakens authorization
- feature guard replacing real business authorization
- malformed input causing unsafe 500s
- broad role presence used instead of actual scoped ownership

Allow merge with follow-up if review finds:

- naming cleanup
- minor logs improvements
- non-critical test gaps
- small normalization issues with no security effect
- documentation alignment issues

---

## Agui Review Checklist

Before merge, confirm:

- [ ] Does auth happen before sensitive lookup?
- [ ] Can a non-member or wrong-house user probe existence?
- [ ] Is ownership explicit and same-scope enforced?
- [ ] Does this use feature guard correctly?
- [ ] Are 403 and 500 still distinguishable?
- [ ] Can malformed input trigger a fake server error?
- [ ] Did this accidentally tighten or broaden access?
- [ ] Does this match current schema contracts and docs?

If any answer is unclear, run the relevant Codex review prompt.

---

## Efficient Usage Pattern

### Do

- batch review with the summary, files changed, and diff
- use one focused review prompt at a time
- re-review only the changed logic after fixes
- reuse the same prompt set across PRs

### Do not

- rely only on GitHub @codex review
- ask vague “review this” prompts
- do one Codex run per tiny comment
- repeat full review unnecessarily after minor fixes

---

## Recommended Agui Workflow

Before opening PR

Run:

- Security and Authorization
- Multi-Tenant and Scope
- Robustness and Edge Cases

Before merge

Run:

- focused re-review on the latest patch
- optional GitHub `@codex review` as extra signal

GitHub review is a bonus, not the main defense.

---

## Final Pre-Merge Prompt

Use this when the PR looks ready:

```text
Final pre-merge review for Agui.

Please review this diff as if you are the final reviewer deciding whether it is safe to merge.

Evaluate:
- security / authorization
- multi-tenant isolation
- robustness / status-code behavior
- architecture / layering
- unintended behavior changes

Agui rules:
- hierarchy != authority
- scope must be explicit
- feature guard is not sufficient business authorization
- every record/object must have an unambiguous home
- preserve existing behavior unless intentionally changed

Return:
1. Blocking issues only
2. Non-blocking follow-ups
3. Merge recommendation: merge / patch first
```

---

## Status

Version: v1  
Scope: Engineering workflow  
Type: Canonical Codex review workflow

## Constraints

- Documentation only
- No code changes
- No workflow automation changes
- Keep aligned with current Agui architecture docs
- Keep language practical and reusable

## Acceptance Criteria

- New engineering doc created
- Docs index updated
- Review kit is copy-paste usable
- No lint/type/test regressions

## Validation

Run:

```bash
npm run -C agui-starter typecheck
npm run -C agui-starter lint
npm run -C agui-starter test
```

## Intent

This document becomes Agui’s standard Codex review workflow so that:

- review becomes consistent
- usage is more efficient
- architecture-sensitive bugs are caught earlier
- GitHub bot review becomes supplemental, not primary
