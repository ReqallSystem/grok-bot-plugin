# Reqall Grok Bot Plugin

Persistent cloud memory for [Grok Bot](https://cursor.com/help/grok-bot/getting-started.md) (Cursor’s desktop assistant).

Reqall is a knowledge graph of issues, specs, architecture, and related work,
with semantic search, hosted at [reqall.net](https://www.reqall.net). This
package gives Grok Bot the family memory loop — **context before work**,
**intend when scope is agreed**, **persist and verify before done** — as
portable skills, a hosted MCP connector, and an `AGENTS.md` autopilot. It
is **not** the [Grok Build](https://grok.com) plugin.

Sibling of [claude-plugin](https://github.com/ReqallSystem/claude-plugin),
[hermes-plugin](https://github.com/ReqallSystem/hermes-plugin), and
[grok-plugin](https://github.com/ReqallSystem/grok-plugin). Those packages
include harness hooks (`SessionStart` / `Stop` / `PreToolUse`, Hermes
`pre_llm_call`, Grok Build `UserPromptSubmit`). Grok Bot has no equivalent
hook runtime, so this plugin is skills + MCP + docs. The 2026.9.x ports
that depend on those hooks — Bash mutation heuristics, Stop-hook timing,
SessionEnd temp-file cleanup, Hermes SQLite / native HTTP / `reqall_skill`
fallback — are intentionally skipped.

## What this is not

- Not Grok Build. Do not run `grok plugin marketplace add`,
  `grok plugin install`, or edit `~/.grok/config.toml`.
- Not a Claude Code `/plugin` marketplace install.
- Not the older rules-only [cursor-plugin](https://github.com/ReqallSystem/cursor-plugin).

## Install

### Authentication

Native MCP OAuth is the preferred path and works from Grok Bot. The three
Cursor callbacks below were registered on the Reqall MCP OAuth client as
of 2026-08-28 (verified: native HTTP connector `user-Reqall` connected
with 18 tools). Add `https://www.reqall.net/mcp` from **Plugins** or
**Customize → MCPs** and finish the Authorize card.

API key Bearer or a token from `reqall login` remains a **fallback**,
not the primary setup.

### Cursor redirect URIs (reference for other hosts)

These Cursor callbacks are already registered on the hosted Reqall
OAuth client. Other hosts need their own redirect URIs allowlisted the
same way:

| Surface | Redirect URI |
|---------|--------------|
| Desktop (custom protocol) | `cursor://anysphere.cursor-mcp/oauth/callback` |
| Desktop | `http://localhost:8787/callback` |
| Web / Cursor Agents | `https://www.cursor.com/agents/mcp/oauth/callback` |

### 1. Preferred: native MCP OAuth

1. In Grok Bot, open **Plugins** (or **Customize → MCPs**).
2. Add the hosted server `https://www.reqall.net/mcp`.
3. Complete **Authorize** / **Authenticate** in the browser.
4. Confirm the connector appears under Installed (Grok Bot shows it as
   `user-Reqall` when connected).

### 2. Fallback: API key or `reqall login` token

If OAuth is unavailable on a given host, create a key at
[reqall.net](https://www.reqall.net) or reuse a token from `reqall login`
on a local CLI. Store it in Grok Bot’s **secure secret card** or your
shell environment as `REQALL_API_KEY`. Never paste the key into chat or
commit it to a repo.

Then send `Authorization: Bearer <REQALL_API_KEY>` on the hosted MCP
endpoint.

**Project or user `mcp.json` (fallback)**

Copy [examples/cursor-mcp.json](examples/cursor-mcp.json) to
`.cursor/mcp.json` (this project) or `~/.cursor/mcp.json` (all projects):

```json
{
  "mcpServers": {
    "reqall": {
      "url": "https://www.reqall.net/mcp",
      "headers": {
        "Authorization": "Bearer ${env:REQALL_API_KEY}"
      }
    }
  }
}
```

Then set `REQALL_API_KEY` in the environment (or Grok Bot’s secret card)
and enable the `reqall` connector from **Customize → MCPs**.

**Local Cursor / Grok Bot plugin**

```bash
git clone https://github.com/ReqallSystem/grok-bot-plugin.git
mkdir -p ~/.cursor/plugins/local
ln -sfn "$PWD/grok-bot-plugin" ~/.cursor/plugins/local/reqall
```

Reload the window. Prefer the native OAuth connect card. If you are
using the API-key fallback, configure `REQALL_API_KEY` under
**Customize → Plugins → Configure**. The bundled `mcp.json` then sends
`Authorization: Bearer ${REQALL_API_KEY}` to `${REQALL_URL}/mcp`
(hosted default `https://www.reqall.net`). Those `${…}` names are plugin
variable placeholders, not secrets checked into git.

On Teams / Enterprise, local plugin imports may be disabled by admin
policy. Use the `mcp.json` connector path instead.

**Self-host**

Set the plugin variable `REQALL_URL` (or `REQALL_URL` in the
environment for a project `mcp.json`). The bundled connector uses
`${REQALL_URL}/mcp`; the hosted default is `https://www.reqall.net`.
Do not put the API key in the JSON file.

### 3. Load skills and autopilot

Skills ship under `skills/<name>/SKILL.md`. After a local plugin install,
Grok Bot / Cursor discovers them from the plugin. For a project-only
install without the plugin folder:

```bash
mkdir -p .cursor/skills
cp -R /path/to/grok-bot-plugin/skills/* .cursor/skills/
```

Copy or merge [AGENTS.md](AGENTS.md) into the project root so context-before-work
and persist-before-done stay on even when a skill is not explicitly invoked.

Invoke skills with `/reqall-context`, `/reqall-persist`, and so on.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `REQALL_API_KEY` | optional | Fallback Bearer token when not using native MCP OAuth |
| `REQALL_URL` | `https://www.reqall.net` | Reqall API base (self-host only) |
| `REQALL_PROJECT_NAME` | auto | Explicit project name (preserved verbatim) |
| `REQALL_MACHINE_NAME` | hostname | Optional whole-segment override for `.machine/<name>/<os-user>` |
| `REQALL_WORKSPACE_ROOT` | auto | Optional workspace root for cwd-relative fallback |
| `REQALL_POLL_INTERVAL_MIN` | few minutes | Optional minimum minutes between `poll_subscriptions` calls. When unset, do not spam poll more than once per few minutes |

Reuse a host-bound project throughout recall and persistence; explicit
operation arguments (including SLEEP) remain authoritative. Otherwise
use `REQALL_PROJECT_NAME` / existing host setting → network Git origin →
explicitly labelled `project_name` or `project` → nearest `.reqall.yml` /
`.reqall.yaml` → nearest `package.json` / `go.mod` / `Cargo.toml` →
exact path relative to a known workspace →
`.machine/<short-lower-hostname>/<os-user>`. Preserve explicit
identifiers; never guess from a basename or an unlabelled slash token.
Route account-wide preferences deliberately to `.user`.

The installed instruction assets embed the full offline policy, including
metadata limits and Git compatibility. Canonical reference:
https://github.com/ReqallSystem/plugins/blob/main/doc/PROJECT_NAMING.md

## Skills

| Skill | Purpose |
|-------|---------|
| `reqall-context` | Bind the project, semantic search, list open records, subscribe/poll, optional impact |
| `reqall-intend` | Record agreed intent (one spec or arch plus links) before starting work |
| `reqall-document` | Persist one meaningful work item with inline links |
| `reqall-persist` | Classify and persist the whole session, reconcile intent, verify writes |
| `reqall-triage` | Incoming issue intake with priority and duplicate check |
| `reqall-review` | Interactive review of open records |
| `reqall-sleep` | Compress memory (consolidate / split / compact / skip / crosslink / promote / discard) |

`reqall-triage`, `reqall-review`, and `reqall-sleep` are user-invoked
(`disable-model-invocation`). `reqall-context`, `reqall-intend`, and
`reqall-persist` are also driven by `AGENTS.md` on non-trivial work.

## MCP operations

The hosted server exposes (host prefixes may vary):

`search`, `upsert_project`, `upsert_record`, `get_record`, `list_records`,
`upsert_link`, `list_links`, `impact`, `sleep_candidates`, `sleep_apply`,
`list_projects`, `list_shares`, `subscribe_project`, `poll_subscriptions`,
`unsubscribe_project`, `list_subscriptions`.

`upsert_record` accepts inline `links[]` (at most 20). Prefer that over a
separate `upsert_link` call; check each per-link result (`created` /
`existing` / `error`) and read back with `list_links`. Never tell the
user work was persisted if the record write failed or a required link
errored.

Destructive ops (`delete_record`, `delete_link`, `share_project`,
`revoke_share`, `delete_project`, `merge_projects`) only when the user
explicitly asks. `merge_projects` is irreversible.

### Subscriptions

When a project is bound, `reqall-context` calls `subscribe_project` once
with a stable `subscriber` label (Grok Bot agent/chat id if known, else a
session-scoped string reused for the conversation) and
`poll_subscriptions` on later non-trivial turns. Treat results as
background context ("Reqall updates since last turn"). Older servers
without the tools fail open silently. There is no hook — skill and
`AGENTS.md` policy only.

## Develop and test

No build step. Static plugin files plus Node tests (Node 20+).

```bash
npm test
```

Tests check the required skill set and frontmatter, MCP URL and Bearer
placeholder, plugin variables, `AGENTS.md` policy, README substance,
that instruction assets embed the shared project-naming policy, and
that the tree contains no hook runtime or committed secrets.

## License

MIT
