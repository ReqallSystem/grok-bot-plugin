---
name: reqall-context
description: Initialize the Reqall project and gather relevant knowledgebase context before starting work. Use at the start of a non-trivial task, or when the user asks to load project memory.
---

# Gather Context

Load project context from Reqall before starting work.

Grok Bot has no SessionStart or PreToolUse hooks. Run this skill yourself
before implementation. Use the Reqall MCP tools from the connected `reqall`
server. Hosts may prefix names; the operations are `upsert_project`,
`search`, `list_records`, `get_record`, and `impact`.

## Steps

1. **Identify the project** — `REQALL_PROJECT_NAME`, then
   `git remote get-url origin` as `org/repo`. Never treat `$HOME`,
   `ubuntu`, `src`, or `workspace` as a project. If unbound, skip upsert
   and search across projects (step 3 only).

2. **Ensure the project exists** — Only if bound: call `upsert_project`
   with that exact name. Note the returned `project_id`.

3. **Search for relevant context** — Call `search` with a conceptual
   query derived from the user's task (not a raw filesystem path). Pass
   `project_name` only when bound.

4. **List open records** — If you have a real `project_id`, call
   `list_records` with `status: "open"` to surface active issues, specs,
   and todos.

5. **Check impact (if relevant)** — If the task changes an existing
   tracked record or component, call `impact`. Skip for new work or
   simple questions.

6. **Present context** — Summarize findings concisely:
   - Relevant records from search
   - Open items for this project
   - Impact analysis results (if run)

   Call `get_record` for full details on records that look particularly
   relevant.

## When to Skip Steps

- Simple question or chat (no coding task): only run step 3 (search).
- Unbound project: do not upsert; search only.
- Search returns nothing: say so and proceed — the project may be new.
- No open records: skip step 4 output.
