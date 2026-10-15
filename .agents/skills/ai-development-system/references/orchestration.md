# ChatGPT-Led Orchestration

## Principle

The owner should have one conversational control surface: ChatGPT.

ChatGPT coordinates repository work, implementation/review tools, CI, deployment evidence, and the Project Control Center. Codex is an implementation/review specialist, not a separate workflow the owner must manage.

## Default behavior

Continue autonomously through all authorized machine-doable steps. Do not create "stop dance" checkpoints after ordinary events such as:

- review requested
- CI started
- deployment building
- reviewer posted comments
- regression completed
- PR became mergeable

Inspect those events and act on them within the orchestration flow.

## Codex

Use Codex where its independence adds value:

- implementation delegation
- hard bug hunting
- final second-opinion review of CONTROLLED changes
- unfamiliar or broad code surfaces

Do not use Codex as a mandatory blocker for every small fix. Refute Codex findings before changing code.

## Waiting

When an external process is pending:

1. continue all non-dependent work;
2. prepare the next stage;
3. persist the exact durable checkpoint;
4. use asynchronous monitoring when supported;
5. if the session must end, say that no owner action is required until the external state changes.

Never design the workflow around the owner periodically typing "continue".

## Human-required UAT

Batch manual UAT into one compact owner session wherever possible. Give exact steps, expected result, and evidence needed.

## Escalate only for

- genuine owner decision
- explicit approval gate
- destructive/irreversible action
- missing credentials/permissions blocking all progress
- real-world UAT
- irreconcilable durable-source conflict

