# Project Control Center

Approved template:
https://docs.google.com/spreadsheets/d/1xsXkqFkuVblpMCV1hbA8CAjxZcut7jSgSxD2fLoNFHk/edit

When Google Drive access is available, copy this file and rename it:

`<Project Name> - Project Control Center`

## Required tabs

1. Overview
2. Current
3. Roadmap
4. Backlog
5. Decisions
6. Questions
7. Risks & Gaps
8. Dev Log
9. UAT & Bugs
10. Releases

## Ownership boundary

The Control Center stores project continuity and owner/project-management truth:
- where we are
- what is next
- roadmap
- decisions
- questions
- gaps/risks
- development history
- UAT/bugs
- releases

Repository files remain canonical for technical contracts, schema, APIs, code, and architecture.

## Resume read order

1. Current
2. unresolved blocking Questions
3. relevant recent Decisions
4. recent Dev Log
5. open UAT & Bugs
6. latest Releases
7. repository AGENTS.md and active milestone docs
8. current Git/PR/CI/deployment state

A fresh chat should not require pasted previous-chat transcripts when these durable sources are complete.


## Work status index
Use .ai-development/state.json for the current structured evidence index and generate STATUS.md. Keep Control Center Current as its owner-facing mirror, with the same release/head/status references. Keep contracts in repository docs and historical events in Dev Log; do not maintain competing current milestone claims in README, manifest and long resume histories. Verify linked evidence independently; state is not authority.
