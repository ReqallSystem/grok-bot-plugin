---
name: reqall-persist
description: Classify and persist all work completed in this session to the Reqall knowledgebase. Use before ending a non-trivial turn or when the user asks to save session memory.
---

# Persist Work

Classify the work completed in this session and save it to the Reqall
knowledgebase. Create one record per distinct work item — sessions often
produce multiple artifacts worth tracking.

Grok Bot has no Stop hook to block the turn. Run this skill yourself
before the final user-facing answer. Use Reqall MCP tools `upsert_project`,
`search`, `list_records`, `upsert_record`, and `upsert_link`. Never persist
secrets.

## Classification Table

| Work type                          | kind    | status   |
|------------------------------------|---------|----------|
| Bug fix                            | issue   | resolved |
| New bug discovered (not yet fixed) | issue   | open     |
| Completed task                     | todo    | resolved |
| New task identified (not yet done) | todo    | open     |
| Architectural change or decision   | arch    | resolved |
| New or updated specification       | spec    | open     |
| Test / verification evidence       | test    | resolved |
| Durable note (convention, how-to)  | info    | resolved |
| Ephemeral session / progress log   | work    | resolved |
| Trivial / Q&A / unclassifiable     | --      | skip     |

Prefer **durable** kinds. Use `work` only for a session log you expect
SLEEP to `promote` or `discard` later.

## Title Conventions

- Issues: `BUG:`, `TASK:`, `BLOCKER:`, `QUESTION:`
- Specs/architecture: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features: `FEAT:`, `REFACTOR:`
- Verification: `TEST:`
- Notes: `INFO:`, `WORK:`

## Steps

1. **Identify the project** — `REQALL_PROJECT_NAME`, then git `org/repo`.
   Never upsert from a generic cwd (`ubuntu`, `$HOME`, `src`, `workspace`).
   If unbound, search first; only `upsert_project` after you have a real
   name. Call `upsert_project` with that exact name to get `project_id`.

2. **Analyze the session** — Review the conversation to identify all
   distinct work items. Scan each category explicitly:
   - Files created or modified
   - Bugs fixed or discovered
   - Architectural or design decisions made
   - Specs written, changed, or discussed
   - Tests added or updated
   - Tasks identified for future work
   - Plans produced by subagents

   A session may produce multiple records, e.g. a bug fix
   (issue/resolved), a new spec (spec/open), and a follow-up task
   (todo/open).

3. **Search, then upsert** — For each non-trivial work item, call
   `search` first (conceptual query, not a raw path). If an existing
   record already tracks this work — especially an open issue, spec, or
   todo — call `upsert_record` with that `record_id` so you update it
   (for example `open` → `resolved`) instead of creating a second
   record. Only omit `record_id` when search finds no match.

   Pass:
   - `project_id` from step 1
   - `record_id` when updating an existing record
   - `kind` and `status` from the classification table
   - A short, descriptive `title` with the appropriate prefix
   - A `body` summarizing what was done, why, and any relevant context.
     Include enough detail for semantic search to find this later.

4. **Create links** — For each meaningful relationship between records
   (new or existing), call `upsert_link`:
   - A bug fix `implements` a spec
   - A test `tests` an architecture decision
   - A new task is `related` to or `blocks` an existing record
   - A spec is `parent` of sub-specifications

   Use `search` to find existing records worth linking to.

5. **Summarize** — Tell the user what was persisted: records
   created/updated, links established.

6. **Verify** — Call `list_records` with the `project_id` to review the
   records just created or updated. Cross-check against the work items
   identified in step 2. If anything was missed, search then upsert
   (update an existing match; do not duplicate).

## When to Skip

If the session was purely Q&A, informational, or trivial (no code changes,
no decisions made), do not create any records. Say "Nothing to persist."
