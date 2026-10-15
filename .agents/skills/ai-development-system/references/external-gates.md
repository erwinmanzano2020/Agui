# External Gate Handling

## Goal

Pending PR checks, CI, Vercel builds, and independent reviews must not create a manual "wait -> owner checks -> owner types continue" loop.

## Short-lived gates: active wait

For gates that normally resolve within minutes:

1. Continue all non-dependent authorized work first.
2. Poll the exact gate inside the same run for a bounded active-wait window.
3. Use increasing intervals rather than tight polling.
4. If the gate turns green, immediately continue to the next already-authorized step.
5. If the gate fails, inspect the failure and fix it without asking the owner unless a real owner decision is required.

A typical bounded window is up to roughly 10-15 minutes when the environment allows it. Do not block the whole run if useful non-dependent work remains.

## Longer gates: background watch

If a gate is still pending after the bounded active-wait window, the owner explicitly authorized background automation, and the host supports it:

- create a background watch/follow-up that checks the exact PR/head/gate;
- continue automatically when the condition becomes ready if the action is already authorized;
- notify the owner only when a real decision, manual UAT, destructive action, or blocking permission is required.

If background tasks are unavailable, persist the exact checkpoint and state clearly that the limitation is environmental. Do not frame the owner as the normal polling mechanism.

## Exact-head discipline

Always monitor the exact current head/commit when a check is commit-sensitive. If a new commit lands, restart the relevant gate assessment against the new head only when that change materially affects the required evidence.

Documentation-only changes do not automatically reopen technical review unless project governance requires it.

## No owner babysitting

Do not ask the owner to:
- refresh GitHub periodically;
- watch CI;
- watch Vercel;
- tell you when checks finish;
- type "check mo" or "continue" merely because an automated gate changed state.

Owner involvement is reserved for the owner-interruption rule in the main AI Development System skill.


Never imply that the active agent continues after ending a turn without an actual supported, authorized background task.
