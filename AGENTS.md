# Reqall Memory Autopilot For Grok Bot

Reqall has two mandatory goals on non-trivial work:

1. Inject relevant context from prior records before implementation.
2. Persist completed work before ending the turn.

Do this automatically. Do not wait for the user to ask.

Grok Bot has no SessionStart / Stop / PreToolUse hook runtime. Skills plus
this policy replace the Claude / Hermes / Grok Build hook loop.

## Tools

Use the Reqall MCP tools from the connected `reqall` server
(`https://www.reqall.net/mcp`). Hosts may prefix names; the operations are:

- `search`
- `upsert_project`
- `upsert_record`
- `get_record`
- `list_records`
- `upsert_link`
- `list_links`
- `impact`
- `sleep_candidates`
- `sleep_apply`
- `delete_record` (only if the user explicitly asks)
- `delete_link` (only if the user explicitly asks)
- `share_project` / `revoke_share` / `delete_project` (only if the user explicitly asks)

Auth is API key Bearer (`REQALL_API_KEY`). Do not try Cursor OAuth against
this endpoint. Never write the API key into a record, chat log, or repo file.

## Skills

Use the bundled skills when available:

- `reqall-context` — initialize the project and gather relevant context
- `reqall-document` — capture one meaningful work item
- `reqall-persist` — persist all meaningful session outcomes
- `reqall-triage` — classify and prioritize incoming issues or requests
- `reqall-review` — review and update open records
- `reqall-sleep` — compress memory (consolidate / split / compact / skip / crosslink / promote / discard)

The automatic flow below is still mandatory even when skills are not exposed.

## Project binding

Never `upsert_project` from `$HOME`, `ubuntu`, `src`, or `workspace`.

Order: `REQALL_PROJECT_NAME` → git remote as `org/repo` → an `org/repo`
mention in the prompt → **unbound** (cross-project search only).

## Trigger Policy

Apply the full memory flow for non-trivial requests:

- code edits
- bug fixes
- refactors
- migrations
- architecture or specification decisions
- test or build work

Skip or minimize for trivial requests:

- greetings
- simple Q&A
- formatting-only output
- one-line informational asks

## Phase A: Automatic Context Injection

There is no SessionStart or PreToolUse hook. Run `reqall-context` (or the
steps below) yourself before implementation:

1. Resolve the project name using the binding order above.
2. If bound, call `upsert_project` with that exact name and store `project_id`.
3. Call `search` using the user task as a conceptual query (not a raw path).
   Pass `project_name` only when bound.
4. If bound, call `list_records` with `project_id` and `status: "open"`.
5. If touching a specific file or component, run an additional targeted
   conceptual search before editing.
6. Call `get_record` for top relevant hits when details matter.
7. If changing existing tracked behavior, call `list_links` and `impact`.
8. Proceed with implementation using this context.

If Reqall MCP is unavailable, continue the user task and say that automatic
context could not run.

## Incremental Documentation

After meaningful edits, build/deploy commands, migrations, configuration
changes, or verification, run `reqall-document` for that item while details
are fresh. Skip read-only, no-op, and formatting-only actions.

## Phase B: Automatic Persistence

Run `reqall-persist` before the final user-facing answer. There is no Stop
hook to block the turn, so you must persist yourself:

1. Enumerate distinct work items completed in the turn.
2. For each meaningful item, call `upsert_record` with appropriate `kind`,
   `status`, `title`, and `body`.
3. Link related records with `upsert_link` when relationships are clear.
4. If verification was run, persist test/build evidence as `kind: "test"`.
5. Persist unresolved follow-ups as open records.
6. Run `list_records` to sanity-check persisted/open items.
7. In the final response, briefly report what was persisted and any
   remaining open follow-ups.

Never rely on the user to remind you to persist.

## Classification Defaults

- Bug fixed → `kind: "issue"`, `status: "resolved"`
- New unfixed bug → `kind: "issue"`, `status: "open"`
- Completed implementation → `kind: "todo"`, `status: "resolved"`
- Follow-up task → `kind: "todo"`, `status: "open"`
- Architecture decision → `kind: "arch"`, `status: "resolved"`
- New or updated spec → `kind: "spec"`, `status: "open"`
- Test/build evidence → `kind: "test"`, `status: "resolved"` when final,
  or `status: "active"` when ongoing
- Durable note → `kind: "info"`
- Ephemeral session log → `kind: "work"` (SLEEP promote/discard)
- Trivial/no-op → skip

Prefer durable kinds. Never persist secrets, tokens, passwords, or private keys.

## Title Conventions

- Issues: `BUG:`, `TASK:`, `BLOCKER:`, `QUESTION:`
- Specs/architecture: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features/refactors: `FEAT:`, `REFACTOR:`
- Verification: `TEST:`
- Notes: `INFO:`, `WORK:`

## Safety

- Prefer status transitions (`open` → `resolved` or `archived`) over deletion.
- Use destructive deletes only on explicit user request.
- If Reqall MCP is unavailable, continue the user task and state clearly
  that automatic context or persistence could not run.
