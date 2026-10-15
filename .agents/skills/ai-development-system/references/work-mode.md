# Work execution and recovery

## Continue and deliver

Use Work as the shared engineering workspace when available. Keep one owner
conversation; internal implementation and review tools are not separate owner
tasks. Record whether source is a real checkout or a connector-materialized copy.
Never claim local Git/build/browser capability that was not observed. Work does
not directly operate the owner's PC. Commit/push source changes before claiming
they are durable; transient workspace files alone are not a save.

Read governance, then state.json and its referenced evidence. Verify exact live
facts only where needed. Resolve routine stale prose and preserve it as history;
escalate unresolved authority/business conflicts. Never re-read the entire project
or require a transcript when bounded current evidence is sufficient.

Implement one user-visible outcome, test locally, inspect a working preview,
converge fixes, then publish the coherent change. Use CI/deployment as final
evidence, not the normal edit loop. When local capabilities are missing, record
the limitation and use the necessary remote check without pretending local PASS.
Choose reviews/tests by changed risk and stronger project policy. Do not inherit
full financial/identity ceremony for a copy-only change that changes no contract.

## One status index

Keep `.ai-development/state.json` free of credentials and private packet values.
Run `node project.mjs check` to validate it, `status` for the continuation brief,
and `render` to generate STATUS.md. Keep AGENTS for rules, SPEC for product
contracts, state for current evidence, and RESUME as an entry pointer. Control
Center Current is the owner-facing mirror; update/read back at meaningful gates.
Manifests describe installation, not a second mutable milestone status.

Track each capability independently: implemented, automated result, physical
result, released, operationally enabled. Require linked source evidence for PASS,
release and activation; structural validation does not verify those links or
grant authority. Never convert a green build into physical acceptance or a
development deployment into production enablement. Use null for unknown metrics,
not invented zeros. Track owner interruptions, manual commands, repeated cases
and recovery minutes so improvements can be measured in actual use.

## One owner entry point

Use `project.cmd` on Windows or `node project.mjs` for status by default. The
launcher works from any current directory. `doctor` checks Node20, Git and PS7
without loading secrets or contacting services. It does not prove connectivity,
credentials, complete source, or business authorization; the adapter's read-only
preflight must verify those before its hidden-input/runtime phase as applicable.

Never download or install a runtime silently. Diagnose missing prerequisites
before asking for private inputs. Resolve PowerShell7 by installed ProgramFiles
path before PATH. The dispatcher never invokes a shell or captures worker output.

`run <head> --ready <absolute-plan-path>` is available only with a tracked,
enabled reviewed owner-adapter.json and worker, exact clean source, prerequisite
checks and a ready owner plan. No live adapter is enabled at bootstrap. The plan
is outside the checkout because a tracked file cannot contain its own commit SHA.
It contains no secrets and is an index, not a replacement for sealed journals.
Adapter argument arrays may use the literal `{head}` placeholder for the pinned source; no shell interpolation is performed. The owner-ready flag means the owner is physically available; it is not a new
governance approval. The worker must independently verify existing authorization,
actual identity/device ownership, immutable history, canonical remote state,
expiry, one-use locks and cleanup. Adapter preflight must be bounded, read-only,
secret-free and noninteractive; a zero exit alone is not cleanup proof.

Do not enable an adapter by copying a retired test command. Each project must
implement/review its real adapter and negative tests before dispatch is enabled.
VVS006R remains retired; this tooling never edits/replays its sources or journals.

## Recovery and short physical sessions

Use `recovery` to classify the recorded lifecycle: NOT_PREPARED, INPUTS_PENDING,
PREPARING, READY, ACTIVE, EXPIRED, CLEANUP_REQUIRED, COMPLETED or UNKNOWN. An active
window past expiry becomes cleanup-required. Completed runs never replay. Unknown
or partial preparation requires canonical inspection; an empty checkpoint folder
does not prove there was no remote read or write. Never delete locks/history to
get around uncertainty or start a second worker while an earlier one may exist.

Add explicit adapter checkpoints before first mutation and after cleanup. Prefer
one authenticated closed-run checkpoint binding source, run/project, exact
history digests, remote resource identifiers, cleanup evidence and retained facts.
Keep originals immutable. Shortening a proof chain requires a separately reviewed
verifier with tamper/replay/unknown-state tests; a plain state.json summary cannot
replace existing cryptographic/ownership checks. No generic tool compacts private
journals or changes existing financial/auth recovery contracts.

Automate ordinary role, denial, approval/revoke, scope, stale-state, replay and
network cases with disposable data. Reserve owner steps for native device prompts,
physical custody and actual usability. `owner-plan` lists only unfinished physical
cases, their reason, total estimate and remaining time. Require passing bound
checks, no unresolved blockers and at least five minutes cleanup reserve. Prepare
before inviting the owner; poll actual readiness rather than an arbitrary wait.
Use one compact checklist with expected outcomes/evidence and visible expiry.
Do not mark a reported screenshot as server truth or turn uncertain errors into
specific diagnoses. Sign out/remove test credentials and verify cleanup explicitly.

## New and existing projects

For new projects, use the preserving bootstrap, a small product blueprint and
one complete first journey: intended user, trigger, outcome, business authority,
synthetic fixture, working preview and acceptance criteria. Add infrastructure
only when the journey or a known invariant requires it. Select minimal relevant
skills; add UI skills when needed. No new live privileges/resources are implied.

For existing projects, dry-run first and explicitly sync reviewed tooling/skills;
preserve unknown local extensions, governance, paused phases, manifests, history,
and feature branches. Review the diff and run workflow plus project-required checks.
Do not reactivate a paused product lane through workflow adoption.

Monitor authorized short CI/review/deployment waits within the active turn. Do
not promise to keep working after the turn ends. Use background automation only
when explicitly authorized and actually supported; otherwise persist the exact
pending checkpoint and next trigger without asking the owner to babysit checks.
