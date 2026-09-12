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
- `list_projects`
- `list_shares` (alongside share / revoke)
- `subscribe_project`
- `poll_subscriptions`
- `unsubscribe_project`
- `list_subscriptions` (if the server exposes it)
- `merge_projects` (only if the user explicitly asks — irreversible)
- `delete_record` (only if the user explicitly asks)
- `delete_link` (only if the user explicitly asks)
- `share_project` / `revoke_share` / `delete_project` (only if the user explicitly asks)

Prefer native MCP OAuth. The Cursor callbacks
(`cursor://anysphere.cursor-mcp/oauth/callback`,
`http://localhost:8787/callback`, and the web / Cursor Agents callback)
were registered on the Reqall MCP OAuth client as of 2026-08-28, so the
Grok Bot connect card works. API key Bearer (`REQALL_API_KEY`) or a token
from `reqall login` is a fallback, not the primary setup. Never write the
token into a record, chat log, or repo file.

## Skills

Use the bundled skills when available:

- `reqall-context` — initialize the project and gather relevant context
- `reqall-intend` — record agreed intent (spec or arch) before non-trivial work
- `reqall-document` — capture one meaningful work item
- `reqall-persist` — persist all meaningful session outcomes
- `reqall-triage` — classify and prioritize incoming issues or requests
- `reqall-review` — review and update open records
- `reqall-sleep` — compress memory (consolidate / split / compact / skip / crosslink / promote / discard)

The automatic flow below is still mandatory even when skills are not exposed.

## Project binding

Never `upsert_project` from `$HOME`, `ubuntu`, `src`, `workspace`, or a
bare cwd basename.

Order: `REQALL_PROJECT_NAME` → git remote as `org/repo` → a labelled
`org/repo` in the prompt → reserved `.machine/<hostname>/<os-user>` →
**unbound** (cross-project search only).

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
5. If bound and the tools exist, `subscribe_project` once with a stable
   `subscriber` label (Grok Bot agent/chat id if known, else a
   session-scoped string reused for this conversation). On later
   non-trivial turns, `poll_subscriptions` and treat results as
   background context ("Reqall updates since last turn"). Honor
   `REQALL_POLL_INTERVAL_MIN` when set; otherwise do not spam poll more
   than once per few minutes. Fail open silently if the tools are missing.
6. If touching a specific file or component, run an additional targeted
   conceptual search before editing.
7. Call `get_record` for top relevant hits when details matter.
8. If changing existing tracked behavior, call `list_links` and `impact`.

If Reqall MCP is unavailable, continue the user task and say that automatic
context could not run.

## Intent

When the user has agreed a non-trivial approach — a plan was accepted,
or they asked for a specific change that introduces new behavior or a
structural decision — run `reqall-intend` before the first
implementation edit. Search first; prefer updating an existing matching
spec/arch. Skip quietly for chores, typos, Q&A, and chat.

`reqall-persist` later reconciles: fulfilled intent gets a
`work` / `todo` / `issue` `--implements-->` that record; unfulfilled
intent gets a blocking todo.

## Incremental Documentation

After meaningful edits, build/deploy commands, migrations, configuration
changes, or verification, run `reqall-document` for that item while details
are fresh. Skip read-only, no-op, and formatting-only actions.

## Phase B: Automatic Persistence

Run `reqall-persist` before the final user-facing answer. There is no Stop
hook to block the turn, so you must persist yourself:

1. Enumerate distinct work items completed in the turn.
2. For each meaningful item, call `search` first. If a matching record
   exists (especially an open issue, spec, or todo), call `upsert_record`
   with its `record_id` so you update it instead of creating a duplicate.
   Otherwise create a new record with appropriate `kind`, `status`,
   `title`, and `body`.
3. Prefer passing `links` on `upsert_record` (inline, at most 20) when
   relationships are clear. Use explicit `relationship`, `direction`,
   and `target_table` when needed. Keep `upsert_link` only as a fallback
   when updating an existing record's links without rewriting the body,
   or when the host truncates `links[]`.
4. Reconcile recorded intent: fulfilled → outcome `--implements-->`
   intent; unfulfilled → open todo `--blocks-->` intent.
5. After each meaningful `upsert_record`, confirm the tool result
   succeeded (an `id` returned / no error). For intended relationships,
   confirm via per-link results and `list_links`. Never tell the user
   "persisted" if the record write failed or a required link errored —
   report partial failure and retry once when safe. Never recreate a
   saved record after a link failure.
6. If verification was run, persist test/build evidence as `kind: "test"`.
7. Persist unresolved follow-ups as open records.
8. Run `list_records` to sanity-check persisted/open items.
9. In the final response, briefly report what was persisted and any
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
