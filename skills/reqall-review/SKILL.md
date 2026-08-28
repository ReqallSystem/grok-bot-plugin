---
name: reqall-review
description: Interactively review and triage open Reqall records for the current project. Use when the user asks to walk through, update, resolve, or archive open memory.
disable-model-invocation: true
---

# Review Open Records

Walk through open records for the current project and triage them
interactively with the user.

Use Reqall MCP tools `upsert_project`, `list_records`, `get_record`,
`upsert_record`, and `upsert_link`. Call `delete_record` only if the
user explicitly asks.

## Steps

1. **Identify the project** — `REQALL_PROJECT_NAME`, then git `org/repo`.
   Never upsert from `$HOME`, `ubuntu`, `src`, or `workspace`. Call
   `upsert_project` to get the `project_id`.

2. **Fetch open records** — Call `list_records` with `project_id` and
   `status: "open"`. If the user specified a kind filter (e.g. "review my
   issues"), add `kind` accordingly. Otherwise fetch all kinds.

3. **Present each record** — For each open record, show its kind, title,
   and status. Call `get_record` for the full body if needed.
   Ask the user:
   - Is this still relevant?
   - Should the status change? (resolve, archive)
   - Does it need more detail or updates?
   - Are there related records to link?

4. **Apply updates** — Based on user responses:
   - `upsert_record` to update status, title, or body
   - `upsert_link` to create new relationships
   - `delete_record` only if explicitly requested

5. **Summarize** — Report what changed: records updated, resolved,
   archived, and links created.
