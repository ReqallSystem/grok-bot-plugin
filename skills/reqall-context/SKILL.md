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

1. **Identify the project** — `REQALL_PROJECT_NAME`, then
   `git remote get-url origin` as `org/repo`, then a labelled
   `org/repo` in the prompt, then the reserved
   `.machine/<hostname>/<os-user>` project. Never treat `$HOME`,
   `ubuntu`, `src`, `workspace`, or a bare cwd basename as a project.
   If unbound, skip upsert and search across projects (step 3 only).

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
