# Reqall Grok Bot Plugin

Persistent cloud memory for [Grok Bot](https://cursor.com/help/grok-bot/getting-started.md) (Cursor’s desktop assistant).

Reqall is a knowledge graph of issues, specs, architecture, and related work,
with semantic search, hosted at [reqall.net](https://www.reqall.net). This
package gives Grok Bot the family memory loop — **context before work**,
**persist before done** — as portable skills, a hosted MCP connector, and an
`AGENTS.md` autopilot. It is **not** the [Grok Build](https://grok.com) plugin.

Sibling of [claude-plugin](https://github.com/ReqallSystem/claude-plugin),
[hermes-plugin](https://github.com/ReqallSystem/hermes-plugin), and
[grok-plugin](https://github.com/ReqallSystem/grok-plugin). Those packages
include harness hooks (`SessionStart` / `Stop` / `PreToolUse`, Hermes
`pre_llm_call`, Grok Build `UserPromptSubmit`). Grok Bot has no equivalent
hook runtime, so this plugin is skills + MCP + docs.

## What this is not

- Not Grok Build. Do not run `grok plugin marketplace add`,
  `grok plugin install`, or edit `~/.grok/config.toml`.
- Not a Claude Code `/plugin` marketplace install.
- Not the older rules-only [cursor-plugin](https://github.com/ReqallSystem/cursor-plugin).

## Install

### 1. Get a Reqall API key

Create a key at [reqall.net](https://www.reqall.net). Store it in Grok Bot’s
**secure secret card** or your shell environment as `REQALL_API_KEY`. Never
paste the key into chat or commit it to a repo.

### 2. Connect the hosted MCP server (API key, not OAuth)

Endpoint: `https://www.reqall.net/mcp`

Auth: `Authorization: Bearer <REQALL_API_KEY>`

Cursor OAuth against this endpoint fails with:

```text
invalid redirect_uri cursor://anysphere.cursor-mcp/oauth/callback
```

Do not use OAuth-only setup. Add the server with connector headers.

**Project or user `mcp.json` (recommended)**

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
ln -sfn "$PWD/grok-bot-plugin" ~/.cursor/plugins/local/reqall
```

Reload the window. In **Customize → Plugins**, configure `REQALL_API_KEY`
(Plugins → Configure). The bundled `mcp.json` sends
`Authorization: Bearer ${REQALL_API_KEY}` to `https://www.reqall.net/mcp`.
That `${REQALL_API_KEY}` is a plugin variable placeholder, not a secret
checked into git.

On Teams / Enterprise, local plugin imports may be disabled by admin
policy. Use the `mcp.json` connector path instead.

**Self-host**

If your Reqall instance is not `https://www.reqall.net`, point `url` at
`${REQALL_URL}/mcp` and set `REQALL_URL` in the environment. Do not put
the API key in the JSON file.

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
| `REQALL_API_KEY` | required | Bearer token for MCP |
| `REQALL_URL` | `https://www.reqall.net` | Reqall API base (self-host only) |
| `REQALL_PROJECT_NAME` | auto | Override project id (`org/repo`) |

Project binding order: `REQALL_PROJECT_NAME` → git remote `org/repo` →
unbound (cross-project search only). Never upsert a project named
`$HOME`, `ubuntu`, `src`, or `workspace`.

## Skills

| Skill | Purpose |
|-------|---------|
| `reqall-context` | Bind the project, semantic search, list open records, optional impact |
| `reqall-document` | Persist one meaningful work item |
| `reqall-persist` | Classify and persist the whole session |
| `reqall-triage` | Incoming issue intake with priority and duplicate check |
| `reqall-review` | Interactive review of open records |
| `reqall-sleep` | Compress memory (consolidate / split / compact / skip / crosslink / promote / discard) |

`reqall-triage`, `reqall-review`, and `reqall-sleep` are user-invoked
(`disable-model-invocation`). `reqall-context` and `reqall-persist` are
also driven by `AGENTS.md` on non-trivial work.

## MCP operations

The hosted server exposes (host prefixes may vary):

`search`, `upsert_project`, `upsert_record`, `get_record`, `list_records`,
`upsert_link`, `list_links`, `impact`, `sleep_candidates`, `sleep_apply`.

Destructive ops (`delete_record`, `delete_link`, `share_project`,
`revoke_share`, `delete_project`) only when the user explicitly asks.

## Develop and test

No build step. Static plugin files plus Node tests (Node 20+).

```bash
npm test
```

Tests check the required skill set and frontmatter, MCP URL and Bearer
placeholder, plugin variables, `AGENTS.md` policy, README substance, and
that the tree contains no hook runtime or committed secrets.

## License

MIT
