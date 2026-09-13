---
name: reqall-context
description: Initialize the Reqall project and gather relevant knowledgebase context before starting work. Use at the start of a non-trivial task, or when the user asks to load project memory.
---

# Gather Context

Load project context from Reqall before starting work.

Grok Bot has no SessionStart or PreToolUse hooks. Run this skill yourself
before implementation. Use the Reqall MCP tools from the connected `reqall`
server. Hosts may prefix names; the operations are `upsert_project`,
`search`, `list_records`, `get_record`, `list_links`, `impact`,
`subscribe_project`, `poll_subscriptions`, and `list_subscriptions` when
the server exposes them.

## Steps

1. **Identify the project** — Reuse the host binding or apply the
   Project naming policy below. Preserve that exact identity for the
   following steps. If unbound, skip upsert and search across projects
   (step 3 only).

2. **Ensure the project exists** — Only if bound: call `upsert_project`
   with that exact name. Note the returned `project_id`.

3. **Search for relevant context** — Call `search` with a conceptual
   query derived from the user's task (not a raw filesystem path). Pass
   `project_name` only when bound.

4. **List open records** — If you have a real `project_id`, call
   `list_records` with `status: "open"` to surface active issues, specs,
   and todos.

5. **Subscribe once** — If bound and the tools exist, call
   `subscribe_project` once with the `project_id` and a stable
   `subscriber` label (the Grok Bot agent or chat id if known, else a
   session-scoped string you invent and reuse for this conversation).
   Each label keeps its own cursor; a new subscription starts at the
   current head, so nothing is replayed. Skip when already subscribed
   this conversation. If the tool does not exist, the server predates
   subscriptions — say nothing and continue.

6. **Poll subscribed updates** — On later non-trivial turns, or when
   running this skill again, call `poll_subscriptions` with the same
   `subscriber` (and `project_id` when known). Treat results as
   background context under "Reqall updates since last turn": fetch
   cited records with `get_record` before relying on them, and skip
   `actor=self` events for records this conversation wrote.
   `list_subscriptions` shows pending counts when present. If
   `REQALL_POLL_INTERVAL_MIN` is set, honor it; otherwise do not spam
   poll more than once per few minutes. Fail open silently if the tools
   are missing.

7. **List links, then impact (if relevant)** — If the task changes an
   existing tracked record or component, call `list_links` on that
   record first to surface directly related records, then call `impact`.
   Skip both for new work or simple questions.

8. **Present context** — Summarize findings concisely:
   - Relevant records from search
   - Open items for this project
   - Subscribed updates since last turn (if any)
   - Directly linked records (if `list_links` ran)
   - Impact analysis results (if run)

   Call `get_record` for full details on records that look particularly
   relevant.

9. **Hand off to intent (if scope is agreed)** — If the task has agreed
   scope — a plan was accepted, or the user asked for a specific,
   non-trivial change — run `reqall-intend` before the first edit so
   the spec/arch record for what is to be exists and is linked. For
   chores, questions, and single-file fixes, skip this.

## When to Skip Steps

- Simple question or chat (no coding task): only run step 3 (search).
- Unbound project: do not upsert or subscribe; search only.
- Search returns nothing: say so and proceed — the project may be new.
- No open records: skip step 4 output.
- Older server without subscription tools: skip steps 5–6 silently.

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
