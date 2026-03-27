## Summary

<!-- What does this PR do? -->

---

## Type of Change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] Migration / Schema
- [ ] Authorization / Access logic

---

## Codex Review Checklist (Required for non-trivial changes)

For any PR affecting:
- routes
- authorization
- storage
- schema
- access layer
- multi-tenant logic

Confirm:

- [ ] Security / Authorization review run
- [ ] Multi-tenant / Scope review run
- [ ] Robustness / Edge-case review run
- [ ] Architecture / Layering review run

Reference:
- docs/engineering/agui-codex-review-kit.md

---

## Engineering Discipline (when applicable)

- [ ] Data access pattern is explicit (auth client vs service role)
- [ ] Tenancy is enforced correctly (house_id / scope)
- [ ] RLS behavior verified for affected tables
- [ ] No silent success on backend errors
- [ ] Relevant docs updated (if applicable)

---

## Risk Assessment

- Does this affect authorization?
- Does this affect tenant isolation?
- Does this change behavior?

<!-- Explain briefly -->

---

## Testing

- [ ] Typecheck passed
- [ ] Lint passed
- [ ] Tests passed

---

## Notes

<!-- Anything reviewers should know -->
