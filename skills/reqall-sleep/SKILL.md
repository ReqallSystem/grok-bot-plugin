---
name: reqall-sleep
description: Compress Reqall project memory — consolidate, split, compact, skip, crosslink, promote, and discard records. Use when the user asks to sleep, compress, or clean up the knowledge graph.
disable-model-invocation: true
---

# SLEEP — compress project memory

**Goal:** Preserve **knowledge** in a **minimal number of short, non-redundant records**.
User invoked sleep → rewrite and delete are expected. Compression is the point.
Knowledge = decisions, outcomes, constraints, IDs, contracts — not session prose.

Ops: `consolidate` · `split` · `compact` · `skip` · `crosslink` · `promote` · `discard`

Rate-limited ~once per 24h per project. **Modest progress is success**.

Use Reqall MCP tools `upsert_project`, `sleep_candidates`, and `sleep_apply`,
plus `get_record`, `list_records`, `list_links`, `search`, and `upsert_link` for review/verification.

## Decision table

| Signal | Action |
|--------|--------|
| Server cluster of highly similar resolved/archived | **consolidate** → one terse durable record; **sources deleted** |
| Isolated resolved/archived; durable but verbose | **compact** |
| Isolated resolved/archived; pure noise | **skip** |
| Active/open; 2+ clearly separable topics | **split** (original deleted by apply) |
| Active/open; single topic, already clear | leave (no op) |
| Cross-project pair; same concept, discovery-useful | **crosslink** |
| Cross-project pair; superficial token overlap | omit |
| `work_review`: unique durable information after comparison | **promote** → durable kind(s), then work log deleted |
| `work_review`: no unique durable information after comparison | **discard** only after preserving useful relationships |
| Candidate unclear / not obvious | **omit this pass** |

`promote` / `discard` apply only to `kind: work`. Never emit `work` from
consolidate/split. Prefer `info` / `arch` / `todo` / `issue` when promoting.

## WORK review policy

Use host equivalents of the tool names below, and only advertised operations/kinds.
If the required reads or operations are unavailable, omit the candidate this pass.

1. Read each WORK log with `get_record`, paginate incoming/outgoing `list_links`,
   and read linked ARCH/SPEC and other durable records. Use project-scoped `search`
   to find existing intent and knowledge, especially when links are missing.
2. **Alignment is not redundancy.** Preserve unique implementation constraints,
   regression fixes, test evidence, outcomes, and remaining limitations even when
   the work followed its spec. Use `promote` into appropriate durable kinds.
3. **Discard only after comparison shows no unique durable information.** Identify
   the surviving records that cover useful content; a knowledge-free log needs none.
   Preserve useful relationships on durable records before discarding: `discard`
   deletes the log's links too. If coverage or relationship meaning is unclear, omit.
4. Preserve an evidence-backed unresolved deviation as a linked `issue`, separating
   expected behavior, observed behavior, and uncertainty about the cause. The
   implementation or the spec may be wrong. Do not automatically rewrite ARCH/SPEC.
5. **Missing links do not prove new requirements.** Reuse intent found by search.
   Promote a novel fact to `info` (or another fitting durable kind); use `spec` only
   for confirmed requirements, never to turn an unapproved proposal into a decision.
6. **Leave ambiguous cases unchanged.** Preserve historical qualifications: dated
   test results and past PR state are not current deployment/runtime guarantees.
7. Before apply, snapshot source records/links and re-read touched records for drift.
   After apply, inspect every result, read back outputs and surviving links, and
   verify deleted sources return structured not-found. Link a new issue to its
   relevant intent with `upsert_link` if needed, then verify. Repair only confirmed
   missing edges. Never replay a destructive batch after an ambiguous response.

## Steps

1. **Project** — arg → `REQALL_PROJECT_NAME` → git `org/repo` → a
   labelled `org/repo` in the prompt → `.machine/<hostname>/<os-user>`.
   Do not invent a name from `$HOME` / `ubuntu` / `src` / `workspace`
   or a bare cwd basename. Call `upsert_project` → `project_id`.
2. **Candidates** — `sleep_candidates` with `project_id`. If rate-limited,
   report next eligible time and stop.
3. **Summary** — counts: consolidate, compact/skip, split, crosslink,
   work_review. Empty → "No eligible candidates this pass."
4. **Select ops** — decision table and WORK review policy above. Bodies: terse, non-redundant.
   - **consolidate** — `kind: "arch"`, `status: "resolved"`; best title; keep knowledge from all members; wording is disposable.
   - **compact** — same id; leaner form.
   - **split** — focused sub-records; kind/status fit each topic (usually match original).
   - **crosslink** — only when useful for discovery.
   - **promote** / **discard** — work logs only. Preserve unique knowledge/evidence;
     discard only after the comparison and relationship checks above.
5. **Apply** — one `sleep_apply` with the batch. No per-op confirmation.
6. **Verify** — inspect every apply result for partial failures; do not
   retry the whole destructive batch after an ambiguous response.
7. **Report** — consolidated / compacted / split / crosslinked / skipped /
   promoted / discarded / errors. If candidates were capped: note to run again later.

## Rules

- Knowledge ≠ wording. Prose is disposable; durable facts are not.
- **consolidate always deletes sources**. **promote** and **discard** delete
  the work log.
- Do not ask whether rewrite/delete is OK — user ran sleep.
- Unclear candidate → omit; do not invent merges or splits.
- Server authorization does not replace client judgment or record/link readback.
- Never persist or rewrite secrets into records.
