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

1. **Identify the project** — Reuse the host binding or apply the
   Project naming policy below. Call `upsert_project` to get the
   `project_id`.

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
segments before normalization. A value outside this grammar is skipped, never
rewritten into a valid name; discovery continues with the next source. Never strip a leading slash to make a path appear
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
