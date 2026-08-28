---
name: reqall-document
description: Document a single meaningful work item by upserting a Reqall record and related links. Use after a substantive edit, decision, or verification — lighter than a full session persist.
---

# Document Work Item

Persist one work item as it happens. This is lighter-weight than
`reqall-persist` — it documents a single action rather than an entire
session.

Grok Bot has no PostToolUse hook. Call this after meaningful work while
details are fresh. Use Reqall MCP tools `upsert_project`, `search`,
`upsert_record`, and `upsert_link`. Never persist secrets.

## When to Skip

Do **not** create a record if the work was:
- A read-only operation (reading files, searching, listing)
- A trivial or failed command (e.g. `ls`, `pwd`, a no-op edit)
- A test run that produced no new findings
- A formatting-only change with no semantic impact

Only document **meaningful** work: file creation, substantive edits,
build/deploy commands, database migrations, configuration changes, etc.

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
| Trivial / no-op                    | --      | skip     |

Prefer durable kinds. `work` is ephemeral (SLEEP promote/discard).

## Title Conventions

- Issues: `BUG:`, `TASK:`, `BLOCKER:`
- Specs: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features: `FEAT:`, `REFACTOR:`
- Notes: `INFO:`, `WORK:`

## Steps

1. **Identify the project** — `REQALL_PROJECT_NAME` or git `org/repo`.
   Never upsert `ubuntu` / `$HOME` / `src` / `workspace`. Call
   `upsert_project` → `project_id`.

2. **Evaluate the work** — Decide whether this is worth documenting.
   If trivial, output "Nothing to document." and stop.

3. **Search for existing records** — Call `search` with a conceptual
   query (not a raw filesystem path). If an existing record covers this
   work, update it via `upsert_record` (pass its `record_id`) rather
   than creating a duplicate.

4. **Upsert the record** — Call `upsert_record` with:
   - `project_id` from step 1
   - `kind` and `status` from the classification table
   - A short, descriptive `title` with the appropriate prefix
   - A `body` summarizing what was done and why. Include file paths,
     command output, or other details useful for future semantic search.

5. **Upsert links** — If the search in step 3 found related records,
   call `upsert_link` to connect them:
   - A bug fix `implements` a spec
   - A test `tests` an architecture decision
   - A new task is `related` to or `blocks` an existing record
   - A spec is `parent` of sub-specifications

6. **Summarize** — Output a one-line summary of what was documented
   (or "Nothing to document." if skipped).
