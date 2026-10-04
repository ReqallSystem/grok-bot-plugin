---
name: reqall-triage
description: Classify incoming issues, gather structured details, and create prioritized Reqall records. Use when the user reports a bug, feature request, or support issue that should become a tracked record.
disable-model-invocation: true
---

# Triage Incoming Issue

Interactively classify a new issue or request from the user, gather
structured details, check for duplicates, and create a well-formed
Reqall record with priority.

Use Reqall MCP tools `upsert_project`, `search`, `list_records`,
`upsert_record`, `upsert_link`, `get_record`, and `list_links`. Never
persist secrets.

## Category Table

| Category             | kind  | prefix    | priority hint         |
|----------------------|-------|-----------|-----------------------|
| Bug report           | issue | BUG:      | P0-P2 based on impact |
| Feature request      | spec  | FEAT:     | P2-P4 typically       |
| Account / billing    | issue | ACCOUNT:  | P1-P2 typically       |
| How-to / docs gap    | todo  | DOCS:     | P3-P4 typically       |
| Integration question | issue | INTEG:    | P2-P3 typically       |

## Priority Scale

| Level | Meaning                                                    |
|-------|------------------------------------------------------------|
| P0    | Critical -- system down, data loss, security, no workaround  |
| P1    | High -- major functionality broken, painful workaround       |
| P2    | Medium -- degraded feature, reasonable workaround            |
| P3    | Low -- minor issue, cosmetic, nice-to-have                   |
| P4    | Wishlist -- enhancement idea, future consideration           |

## Steps

1. **Identify the project** -- Reuse the host binding or apply the
   Project naming policy below. Call `upsert_project` with that exact
   name to get the `project_id`.

2. **Get the initial description** -- Ask the user to describe their issue
   or request in their own words. If they already provided a description
   in the same message that invoked this skill, use that directly.

3. **Classify the category** -- Based on the description, determine the
   category from the Category Table. Tell the user the classification
   and ask them to confirm or correct it.

4. **Gather structured details** -- Based on the confirmed category, ask
   targeted follow-up questions. Ask only what is missing from the
   initial description -- skip questions already answered.

   **Bug report:**
   - Steps to reproduce (numbered)
   - Expected behavior vs actual behavior
   - Environment (OS, browser, runtime version, relevant config)
   - Frequency (always, intermittent, one-time)
   - Error messages or log output
   - Severity self-assessment (blocking work? workaround available?)

   **Feature request:**
   - Use case / user story ("As a ___, I want ___ so that ___")
   - Who benefits and how many users affected
   - Current workaround (if any)
   - Desired behavior in detail
   - Acceptance criteria (how to know it is done)

   **Account / billing:**
   - Account identifier or context
   - Plan or tier
   - Specific charge, feature, or access issue
   - Urgency (blocking work? time-sensitive?)

   **How-to / docs gap:**
   - What they are trying to accomplish
   - What they have tried so far
   - Which documentation they consulted
   - Where the gap or confusion is

   **Integration question:**
   - Which integration, API, or service
   - Version numbers (SDK, API, runtime)
   - Error messages or unexpected responses
   - Code snippet or configuration (if relevant)

5. **Search for duplicates** -- Call `search` with a natural language
   summary of the issue, using the `project_name` parameter. Also call
   `list_records` with `project_id`, `kind` matching the category, and
   `status: "open"` to scan existing open records.

   If potential duplicates are found:
   - Show them to the user with title and body summary
   - Ask: "Is this the same issue, related, or a new issue?"
   - If duplicate: update the existing record with new details via
     `upsert_record` (pass its `record_id`), add a note about the
     additional report, and stop
   - If related: proceed to create a new record and link it in step 8

6. **Determine priority** -- Assess priority using the Priority Scale
   based on these signals:
   - Severity from the user's description and answers
   - Scope of impact (one user vs many, core feature vs edge case)
   - Workaround availability
   - Category default hints from the Category Table

   Present the proposed priority to the user and let them confirm or
   override it.

7. **Create the record** -- Call `upsert_record` with:
   - `project_id` from step 1
   - `kind` from the Category Table
   - `status`: `open`
   - `title`: `{PREFIX} {PRIORITY}: {concise title}`
     Example: `BUG: P1: Login fails silently on Safari 18`
   - `links`: the relationships from step 8, inline
   - `body`: a structured summary including:
     - **Category:** the classification
     - **Priority:** level and justification
     - **Description:** the user's original description
     - **Details:** all gathered structured details
     - **Reporter context:** any relevant user/session context

8. **Link** -- If step 5 found related (non-duplicate) records, pass
   them as inline `links` on the `upsert_record` call in step 7 (one
   call creates the record and its edges). Use `upsert_link` only when
   updating an existing record's links without rewriting the body, or
   when the host truncates `links[]`. Check every link result:
   `created` / `existing` succeed; `error` means the record saved but
   the edge did not -- repair with `upsert_link`, never recreate the
   record. Confirm with `list_links` when a result was ambiguous.
   - Bug that may be caused by an arch decision: `related`
   - Feature request that extends an existing spec: `related`
   - Bug that blocks a todo: `blocks`
   - Duplicate or near-duplicate: `related` with a note

9. **Summarize** -- Report to the user:
   - Record created (title, kind, priority)
   - Any links established
   - Any duplicates noted
   - Suggested next steps (e.g., "This P1 bug should be investigated
     soon" or "This P4 feature request has been queued")
   - Any partial link failure separately from verified writes

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
`upsert_link` (reverse the endpoints for an incoming link) -- never
recreate a record that already saved.

## When to Skip

If the user's description is too vague to classify after one round of
follow-up questions, ask once more for clarification. If still
insufficient, create the record as `kind: issue` with `P3` priority
and a `TRIAGE:` prefix, noting in the body that further clarification
is needed.

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
