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

Use Reqall MCP tools `upsert_project`, `sleep_candidates`, and `sleep_apply`.

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
| `work_review`: durable knowledge in a work log | **promote** → durable kind(s), then work log deleted |
| `work_review`: no durable knowledge | **discard** (deletes the work log) |
| Candidate unclear / not obvious | **omit this pass** |

`promote` / `discard` apply only to `kind: work`. Never emit `work` from
consolidate/split. Prefer `info` / `arch` / `todo` / `issue` when promoting.

## Steps

1. **Project** — arg → `REQALL_PROJECT_NAME` → git `org/repo` → a
   labelled `org/repo` in the prompt → `.machine/<hostname>/<os-user>`.
   Do not invent a name from `$HOME` / `ubuntu` / `src` / `workspace`
   or a bare cwd basename. Call `upsert_project` → `project_id`.
2. **Candidates** — `sleep_candidates` with `project_id`. If rate-limited,
   report next eligible time and stop.
3. **Summary** — counts: consolidate, compact/skip, split, crosslink,
   work_review. Empty → "Nothing to do — graph is healthy."
4. **Select ops** — decision table only. Bodies: terse, non-redundant.
   - **consolidate** — `kind: "arch"`, `status: "resolved"`; best title; keep knowledge from all members; wording is disposable.
   - **compact** — same id; leaner form.
   - **split** — focused sub-records; kind/status fit each topic (usually match original).
   - **crosslink** — only when useful for discovery.
   - **promote** / **discard** — work logs only. `promote` writes durable
     records carrying the work log's decisions, outcomes, and
     constraints; drop the narrative. `discard` when nothing durable
     remains.
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
- Safety is enforced by `sleep_apply` — do not re-check.
- Never persist or rewrite secrets into records.
