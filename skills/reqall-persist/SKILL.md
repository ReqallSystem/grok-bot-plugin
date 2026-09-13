---
name: reqall-persist
description: Classify and persist all work completed in this session to the Reqall knowledgebase. Use before ending a non-trivial turn or when the user asks to save session memory.
---

# Persist Work

Classify the work completed in this session and save it to the Reqall
knowledgebase. Create one record per distinct work item — sessions often
produce multiple artifacts worth tracking.

Grok Bot has no Stop hook to block the turn. Run this skill yourself
before the final user-facing answer. Use Reqall MCP tools
`upsert_project`, `search`, `list_records`, `get_record`,
`upsert_record`, `upsert_link`, and `list_links`. Never persist secrets.

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

1. **Identify the project** — Reuse the host binding or apply the
   Project naming policy below. If unbound, search first; only
   `upsert_project` after you have a real name. Call `upsert_project`
   with that exact name to get `project_id`.

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
   - `links` (when the tool schema offers it): the record's
     relationships from steps 4 and 5, inline — e.g. the `work` record
     with `{target_id: <spec>, relationship: "implements"}`, a gap
     `todo` with `{target_id: <spec>, relationship: "blocks"}`. One
     call, no separate `upsert_link` to forget.

4. **Reconcile intent** — If `reqall-intend` wrote or selected a
   spec/arch this session (or you know one was agreed), measure
   outcomes against it:
   - Call `get_record` if you need its acceptance criteria. Do not
     resolve intent whose acceptance criteria are unverified, and never
     mark a spec resolved as a substitute for the `implements` link.
   - **Fulfilled** → a `work`, `todo`, or `issue` outcome
     `--implements-->` the intent (inline `links` on its upsert, or
     `upsert_link`). Set that outcome `status: "resolved"`. Leave the
     spec itself `open` unless the user treats specs as tickets to
     close.
   - **Partly or not fulfilled** → create a `todo`/`open` naming the
     gap with an inline link that `blocks` the intent. Keep a session
     `work` record `active` if one exists.
   - **Superseded** → update the intent record's body to the approach
     actually taken, and note the change in the outcome. Do not leave a
     stale spec behind.

5. **Create links** — For each other meaningful relationship between
   records: inline via `links` on the record's own upsert, or
   `upsert_link` between two records that already exist:
   - A bug fix `implements` a spec
   - A test `tests` an architecture decision
   - A new task is `related` to or `blocks` an existing record
   - A spec is `parent` of sub-specifications

   Use `search` to find existing records worth linking to.

6. **Verify each write** — After every meaningful `upsert_record`,
   confirm the tool result succeeded (an `id` returned / no error).
   For intended relationships, confirm via per-link results
   (`created` / `existing`) and `list_links` readback. An `error` link,
   a missing entry, or a count mismatch is partial failure even though
   the record saved. Repair with `upsert_link` once when safe — never
   recreate a saved record. Retry the record write once when the
   transport failed and no `id` was returned. Never tell the user
   "persisted" if the record write failed or a required link errored;
   report the partial failure.

7. **Summarize** — Tell the user what was persisted: records
   created/updated, links established, intent fulfilled or blocked.
   Separate verified successes from remaining failures.

8. **Sanity-check** — Call `list_records` with the `project_id` to
   review the records just created or updated. Cross-check against the
   work items identified in step 2. If anything was missed, search then
   upsert (update an existing match; do not duplicate).

## Inline links and verification

Prefer passing `links` on `upsert_record` (at most 20) over a separate
`upsert_link`-only flow. Each entry names `target_id`, `relationship`,
and, when it matters, `target_table` (`records` or `projects`) and
`direction` (`outgoing`: this record → target, the default; `incoming`:
target → this record). Use `implements` for outcome → intent, `tests`
for evidence → subject, `blocks` for blocker → blocked item, and
`parent` / `related` only when justified.

Check the record result **and every per-link result**: `created` or
`existing` succeeds; `error`, a missing entry, or a count mismatch is
partial failure even though the record saved. After writes, call
`list_links` to confirm intended edges. Repair a missing link with
`upsert_link` (reverse the endpoints for an incoming link) — never
recreate a record that already saved.

Keep `upsert_link` only as a fallback when updating an existing
record's links without rewriting the body, or when the host truncates
`links[]`.

## When to Skip

If the session was purely Q&A, informational, or trivial (no code changes,
no decisions made), do not create any records. Say "Nothing to persist."

## Project naming policy

Use a host-supplied binding as authoritative: reuse its exact project name through recall, work, persistence, and verification. Do not independently rediscover it in later steps. Preserve deliberate operation arguments (including a manual SLEEP target) and supported session selections; these instructions do not install automatic hooks or invent host settings. If no binding exists, discover locally using the policy below. If required local information is unavailable, ask for an explicit project instead of guessing; do not write to an invented project.

Canonical contract: https://github.com/ReqallSystem/plugins/blob/main/doc/PROJECT_NAMING.md
The following embedded policy works offline.

Reqall project names must agree across clients. This is client-side discovery, not
server-side filesystem inspection. Do not migrate or rename existing records as a
side effect of discovery. Reuse the exact project bound by the host's context hook
through recall, work, persistence, and verification.

## Precedence

Preserve deliberate operation arguments (for example a SLEEP target) and supported
session selections. For automatic discovery use the first available source:

1. Nonempty, trimmed `REQALL_PROJECT_NAME`, or an existing host-scoped project
   setting. Environment wins over settings. Do not invent a new settings mechanism
   in hosts that have none.
2. Actual network Git `origin`, normalized as below.
3. An explicitly labelled `project_name` or `project` selection in the user's
   prompt, or the host's retained session selection. Labels accept `:` or `=` and
   unquoted, single-quoted, double-quoted, or backtick-quoted values. Strip sentence
   punctuation only from unquoted values. Incidental paths, URLs, quoted examples
   in synthetic notifications, and arbitrary slash tokens are not a selection.
4. Nearest valid ancestor `.reqall.yml` or `.reqall.yaml` identity.
5. Nearest valid package identity: `package.json`, `go.mod`, then `Cargo.toml` at
   each directory, before moving to its parent.
6. Exact POSIX-style cwd-relative path within a known workspace root.
7. Reserved `.machine/<short-lower-hostname>/<os-user>`.

Use OS account identity, not `USER`/`USERNAME` environment hints. A nonempty
`REQALL_MACHINE_NAME` replaces the whole hostname segment; sanitize and lowercase
it, but retain dots in this deliberate override. Account-wide preferences may be
routed deliberately to `.user`. Do not use an unconstrained cwd basename.

Explicit names are identifiers, not metadata to repair: preserve them apart from
outer whitespace. The automatic metadata/path checks below do not silently rewrite
manually selected historical names.

## Git compatibility

Accept network HTTP(S), SSH, and Git URLs and SCP-style remotes. Remove trailing
slashes and the terminal `.git` suffix. Retain the final two path segments, e.g.
`https://github.com/acme/widgets.git` becomes `acme/widgets`.

This intentionally retains the existing server/client convention for nested Git
namespaces: `https://gitlab.com/group/sub/repo.git` becomes `sub/repo`. Keeping the
whole namespace requires a separate identity/migration decision; this alignment
must not silently fork existing memory. Local POSIX/Windows paths and `file:`
remotes are not portable naming sources and fall through to local metadata.

## Portable metadata

Read regular, UTF-8 files of at most 64 KiB. Unreadable, oversized, malformed,
unsupported, and non-string values are skipped without crashing. Search nearest
valid ancestors, stopping at a known containing workspace root (inclusive), or at
the filesystem root when no containing workspace boundary is known.

Automatic names use ASCII letters/digits, `_`, `-`, and `.` within slash-separated
segments. Reject absolute POSIX, drive, UNC, backslash, tilde, empty, `.` and `..`
segments before normalization. Never strip a leading slash to make a path appear
portable. Explicit metadata named `src` or `work` is valid; a directory-noise
blacklist must not override intentional metadata.

### Reqall YAML

Use a simple top-level string scalar:

```yaml
project: acme/notes
```

`name` is accepted as an alias; a valid `project` takes precedence. At a directory,
`.reqall.yml` takes precedence over `.reqall.yaml`. Matching single/double quotes
and trailing comments are supported; plain boolean/null/numeric values are not
string identities. Nested mappings, aliases, multiline scalars, and other complex
YAML are not supported. Ambiguous duplicate keys and malformed quoting are rejected.

### Package declarations

- `package.json`: a string `name`. Only a valid npm scoped identity removes one
  leading `@`: `@acme/widgets` becomes `acme/widgets`. Numbers are not coerced.
- `go.mod`: the complete declared `module`, preserving domain, nested path, and
  major-version suffix, e.g. `example.com/acme/widgets/v2`. Comments before the
  declaration are allowed. An empty file is not an error.
- `Cargo.toml`: a simple quoted `name` inside `[package]`, never a `[[bin]]` or
  dependency name. This is a constrained declaration reader, not a full TOML parser.

## Workspace-relative fallback

`REQALL_WORKSPACE_ROOT` supplies the root; relative values are resolved from cwd,
and `~/` uses the current home. Otherwise use the nearest ancestor regular
`.reqall-workspace` marker file. The setting is read from the process environment
when no explicit environment mapping is supplied.

Resolve filesystem paths before containment checks so symlinks cannot escape the
workspace. An invalid or non-containing explicit root does not silently select a
marker instead. Cwd equal to the root produces no relative identity. Preserve all
relative segments, including `src` or `work`; dropping them can merge unrelated
projects. A plain folder without a known root still falls back to machine memory.
