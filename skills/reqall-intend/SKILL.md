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

1. **Identify the project** — `REQALL_PROJECT_NAME`, then
   `git remote get-url origin` as `org/repo`, then a labelled
   `org/repo` in the prompt, then the reserved
   `.machine/<hostname>/<os-user>` project. Never treat `$HOME`,
   `ubuntu`, `src`, `workspace`, or a bare cwd basename as a project.
   Call `upsert_project` with that exact name and note the
   `project_id`.

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
