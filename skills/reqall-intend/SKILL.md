---
name: reqall-intend
description: Record agreed intent (a spec or arch record) and its links in Reqall before starting non-trivial work. Use when the user has agreed an approach and before the first implementation edit.
---

# Record Intent

Write down *what is to be* before doing it. A spec (new behavior) or arch
(structural decision) record created here is the yardstick `reqall-persist`
later measures the session's work against: fulfilled intent gets a
`work` / `todo` / `issue` `--implements-->` intent link; unfulfilled
intent gets a blocking todo.

Grok Bot has no ExitPlanMode, UserPromptSubmit, or Stop hook. Run this
skill yourself when the user has agreed an approach — a plan was
accepted, or they asked for a specific non-trivial change — and before
the first implementation edit.

This is deliberately small: at most two write calls, usually one.

## When to Run

Run only when **both** hold:

1. The work introduces new behavior, a contract, or a structural
   decision — not a chore, a typo, a single-file fix, a question, or
   chat.
2. The scope is agreed — a plan was accepted, or the user confirmed an
   approach or asked for a specific change.

If either fails, do nothing and say nothing. Over-recording intent
creates spec inflation, which is worse than a missing record.

Use Reqall MCP tools `upsert_project`, `search`, `get_record`,
`list_records`, `impact`, `upsert_record`, `upsert_link`, and
`list_links`. Never persist secrets.

## Steps

1. **Identify the project** — Reuse the host binding or apply the
   Project naming policy below. Call `upsert_project` with that exact
   name and note the `project_id`.

2. **Search first** — Call `search` with a one-sentence description of
   the intended change, `project_name` set when bound, `kind: "spec"`
   or `"arch"` as appropriate (or omit kind). Call `get_record` on the
   best hit if the title alone is ambiguous.

3. **Prefer existing over new**
   - An existing spec/arch already describes this intent → call
     `get_record` on it, then **update it** via `upsert_record` (pass
     its `id` / `record_id`) only if the agreed scope adds something;
     otherwise leave it as is.
   - No match → **create one record**:
     - `kind: "spec"`, `status: "open"` for new or changed behavior.
       Title prefix by area: `SPEC:`, `API:`, `AUTH:`, `DATA:`, `UI:`.
     - `kind: "arch"`, `status: "open"` for a structural decision the
       work will realize. Title prefix `ARCH:`.
     - `body`: what will exist when the work is done, why, the agreed
       approach (the accepted plan summary if there is one), acceptance
       criteria, and explicit non-goals. Write for future semantic
       search, not for this session. Reference the GH issue or ticket
       if any.
     - `links`: pass the relationships from step 4 **inline on this
       same call** when the tool schema offers `links` — one call
       creates the record and its edges. Fall back to `upsert_link`
       only when updating an existing record's links without rewriting
       the body, or when the host truncates `links[]`.

4. **Link** — For each related record found in step 2 (inline via
   `links` where possible, else `upsert_link`):
   - when the new intent is a **sub-spec** of an existing broader spec,
     create an **incoming** `parent` edge from the broader spec → this
     new record (inline `links[]`: `relationship: "parent"`,
     `direction: "incoming"`, `target_id` = the broader spec id).
     Equivalently: broader `--parent-->` narrower. If hierarchy is
     not clear, use `related` instead of guessing parent. Do not make
     the narrower record an outgoing `parent` of the broader one.
   - new spec `implements` an existing arch decision
   - existing open issue/todo is `related` to the intent it motivated
   - if the task changes tracked behavior, call `impact` on the
     existing record and link anything downstream that this work
     touches as `related`

5. **Check the link results** — every inline link reports `created`,
   `existing`, or `error`. An `error` is partial persistence: repair it
   with `upsert_link` between the two existing records; do not
   re-upsert the spec without its `id`, and never create it twice.
   Confirm with `list_links` when the result was ambiguous.

6. **Report in one line** — "Intent: #<id> <kind> <title>
   (created|updated|existing), linked to #a, #b." Then start the work.

## How persist reconciles this later

`reqall-persist` (Phase B) measures outcomes against this record:

- **Fulfilled** — a `work`, `todo`, or `issue` outcome
  `--implements-->` this intent. Leave the spec itself `open` unless
  the user treats specs as tickets to close.
- **Unfulfilled or partial** — an open todo `--blocks-->` this intent,
  naming the gap. Keep the session `work` record `active` if one
  exists.
- **Superseded** — update this record's body to the approach actually
  taken; do not leave a stale spec behind.

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

## Do Not

- Make a separate `upsert_link` call for a link you could have passed
  inline on the `upsert_record` call — the second call is the one that
  gets skipped, and an unlinked spec is invisible to `impact`.
- Create a record for work that has no agreed scope yet — ask, or wait
  for the plan to be accepted.
- Create more than one spec/arch per task. Sub-scopes belong in the
  body.
- Create `work`, `todo`, or `issue` records here — those are outcomes,
  which `reqall-persist` and `reqall-document` handle.
- Duplicate an existing spec because its wording differs. Update or
  link.

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
