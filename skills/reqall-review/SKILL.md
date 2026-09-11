---
name: reqall-review
description: Interactively review and triage open Reqall records for the current project. Use when the user asks to walk through, update, resolve, or archive open memory.
disable-model-invocation: true
---

# Review Open Records

Walk through open records for the current project and triage them
interactively with the user.

Use Reqall MCP tools `upsert_project`, `list_records`, `get_record`,
`upsert_record`, `upsert_link`, and `list_links`. Call `delete_record`
only if the user explicitly asks.

## Steps

1. **Identify the project** — `REQALL_PROJECT_NAME`, then git
   `org/repo`, then a labelled `org/repo` in the prompt, then the
   reserved `.machine/<hostname>/<os-user>` project. Never upsert from
   `$HOME`, `ubuntu`, `src`, `workspace`, or a bare cwd basename. Call
   `upsert_project` to get the `project_id`.

2. **Fetch open records** — Call `list_records` with `project_id` and
   `status: "open"`. If the user specified a kind filter (e.g. "review my
   issues"), add `kind` accordingly. Otherwise fetch all kinds.
   Follow pagination before claiming every record was reviewed.

3. **Present each record** — For each open record, show its kind, title,
   and status. Call `get_record` for the full body if needed.
   Ask the user:
   - Is this still relevant?
   - Should the status change? (resolve, archive)
   - Does it need more detail or updates?
   - Are there related records to link?

4. **Apply updates** — Based on user responses:
   - `upsert_record` with the record's `id` / `record_id` and only the
     changed fields; pass new relationships inline via `links` on that
     same call
   - `upsert_link` only for a new relationship between two records that
     are otherwise unchanged, or when the host truncates `links[]`
   - `delete_record` only if explicitly requested
   - a status change is not implementation evidence: do not resolve a
     spec or arch record because the user says the work is done — that
     belongs to an outcome record that `implements` it

5. **Verify and summarize** — Check each record and link result
   (`created` / `existing` succeed; `error` is a partial failure to
   repair with `upsert_link`, never by recreating the record). After
   writes, call `list_links` to confirm intended edges. Report what
   changed: records updated, resolved, archived, and links created,
   separately from anything that failed.

## Inline links and verification

Prefer passing `links` on `upsert_record` (at most 20) over a separate
`upsert_link`-only flow. Each entry names `target_id`, `relationship`,
and, when it matters, `target_table` (`records` or `projects`) and
`direction` (`outgoing`: this record → target, the default; `incoming`:
target → this record).

Check the record result **and every per-link result**: `created` or
`existing` succeeds; `error`, a missing entry, or a count mismatch is
partial failure even though the record saved. After writes, call
`list_links` to confirm intended edges. Repair a missing link with
`upsert_link` (reverse the endpoints for an incoming link) — never
recreate a record that already saved.

Keep `upsert_link` only as a fallback when updating an existing
record's links without rewriting the body, or when the host truncates
`links[]`.
