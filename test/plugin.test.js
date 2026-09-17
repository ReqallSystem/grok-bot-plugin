import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_SKILLS = [
  'reqall-context',
  'reqall-intend',
  'reqall-persist',
  'reqall-document',
  'reqall-triage',
  'reqall-review',
  'reqall-sleep'
]

const CONTEXT_OPS = [
  'upsert_project',
  'search',
  'list_records',
  'get_record',
  'list_links',
  'impact',
  'subscribe_project',
  'poll_subscriptions'
]
const INTEND_OPS = [
  'upsert_project',
  'search',
  'get_record',
  'upsert_record',
  'upsert_link',
  'list_links'
]
const PERSIST_OPS = [
  'upsert_project',
  'search',
  'list_records',
  'upsert_record',
  'upsert_link',
  'list_links'
]
const DOCUMENT_OPS = [
  'upsert_project',
  'search',
  'upsert_record',
  'upsert_link',
  'list_links'
]
const TRIAGE_OPS = [
  'upsert_project',
  'search',
  'list_records',
  'upsert_record',
  'upsert_link',
  'list_links'
]
const REVIEW_OPS = [
  'upsert_project',
  'list_records',
  'get_record',
  'upsert_record',
  'upsert_link',
  'list_links'
]
const SLEEP_OPS = ['upsert_project', 'sleep_candidates', 'sleep_apply']

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function parseFrontmatter(text) {
  assert.match(text, /^---\n/, 'SKILL.md must start with YAML frontmatter')
  const end = text.indexOf('\n---\n', 4)
  assert.notEqual(end, -1, 'SKILL.md frontmatter must close')
  const raw = text.slice(4, end)
  const fields = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (match) fields[match[1]] = match[2].trim()
  }
  return { fields, body: text.slice(end + 5) }
}

function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(path, acc)
    else acc.push(path)
  }
  return acc
}

describe('reqall grok-bot plugin package', () => {
  it('ships the required skill set with matching frontmatter names', () => {
    const skillsDir = join(root, 'skills')
    const found = readdirSync(skillsDir).sort()
    assert.deepEqual(found, [...REQUIRED_SKILLS].sort())

    for (const name of REQUIRED_SKILLS) {
      const skillPath = join(skillsDir, name, 'SKILL.md')
      assert.ok(existsSync(skillPath), `${name} is missing SKILL.md`)
      const { fields, body } = parseFrontmatter(read(`skills/${name}/SKILL.md`))
      assert.equal(fields.name, name)
      assert.ok(fields.description, `${name} needs a description`)
      assert.ok(fields.description.length > 20, `${name} description is too short`)
      assert.ok(body.trim().length > 200, `${name} body is too short`)
      assert.match(body, /^# /m, `${name} should have a markdown title`)
    }
  })

  it('user-invoked skills mark disable-model-invocation', () => {
    for (const name of ['reqall-triage', 'reqall-review', 'reqall-sleep']) {
      const { fields } = parseFrontmatter(read(`skills/${name}/SKILL.md`))
      assert.equal(fields['disable-model-invocation'], 'true')
    }
  })

  it('skills describe the family MCP operations and Grok Bot limits', () => {
    const expected = {
      'reqall-context': CONTEXT_OPS,
      'reqall-intend': INTEND_OPS,
      'reqall-persist': PERSIST_OPS,
      'reqall-document': DOCUMENT_OPS,
      'reqall-triage': TRIAGE_OPS,
      'reqall-review': REVIEW_OPS,
      'reqall-sleep': SLEEP_OPS
    }

    for (const [name, ops] of Object.entries(expected)) {
      const text = read(`skills/${name}/SKILL.md`)
      for (const op of ops) {
        assert.ok(text.includes(op), `${name} should mention ${op}`)
      }
      assert.doesNotMatch(text, /~\/\.grok\/config\.toml/)
      assert.doesNotMatch(text, /mcp__plugin_reqall_reqall__/)
      assert.doesNotMatch(text, /allowed-tools:/)
      assert.doesNotMatch(text, /grok plugin (marketplace add|install)/)
    }

    const persist = read('skills/reqall-persist/SKILL.md')
    assert.match(persist, /Never persist\s+secrets/)
    assert.match(persist, /kind/)
    assert.match(persist, /status/)
    assert.match(persist, /record_id/)
    assert.match(persist, /Search, then upsert/)
    assert.match(persist, /instead of creating a second/)
    assert.match(persist, /Reconcile intent/)
    assert.match(persist, /--implements-->/)
    assert.match(persist, /Never tell the user/)
    assert.match(persist, /never\s+recreate a (saved )?record/i)
    assert.match(persist, /at most 20/)

    const context = read('skills/reqall-context/SKILL.md')
    const linksIdx = context.indexOf('list_links')
    const impactIdx = context.indexOf('call `impact`')
    assert.ok(linksIdx !== -1 && impactIdx !== -1 && linksIdx < impactIdx)
    assert.match(context, /subscribe_project/)
    assert.match(context, /poll_subscriptions/)
    assert.match(context, /REQALL_POLL_INTERVAL_MIN/)
    assert.match(context, /reqall-intend/)

    const intend = read('skills/reqall-intend/SKILL.md')
    assert.match(intend, /kind: "spec"/)
    assert.match(intend, /kind: "arch"/)
    assert.match(intend, /reqall-persist/)
    assert.match(intend, /--implements-->/)
    assert.match(intend, /blocking todo/)
    assert.match(intend, /at most 20/)
    assert.match(intend, /never create it twice/)
    assert.doesNotMatch(intend, /Triggered by the ExitPlanMode/)
    assert.doesNotMatch(intend, /allowed-tools:/)
  })

  it('skills share machine binding and the inline-link contract', () => {
    const linkSkills = [
      'reqall-intend',
      'reqall-persist',
      'reqall-document',
      'reqall-triage',
      'reqall-review'
    ]
    for (const name of REQUIRED_SKILLS) {
      const text = read(`skills/${name}/SKILL.md`)
      assert.match(text, /\.machine\/<hostname>\/<os-user>/)
      assert.match(text, /cwd basename/)
    }
    for (const name of linkSkills) {
      const text = read(`skills/${name}/SKILL.md`)
      assert.match(text, /target_table/)
      assert.match(text, /outgoing/)
      assert.match(text, /incoming/)
      assert.match(text, /created/)
      assert.match(text, /existing/)
      assert.match(text, /error/)
      assert.match(text, /list_links/)
    }

    const sleep = read('skills/reqall-sleep/SKILL.md')
    assert.match(sleep, /work_review/)
    assert.match(sleep, /\*\*promote\*\*/)
    assert.match(sleep, /\*\*discard\*\*/)
  })

  it('mcp.json interpolates REQALL_URL and a Bearer placeholder', () => {
    const mcp = JSON.parse(read('mcp.json'))
    const server = mcp.mcpServers.reqall
    assert.equal(server.url, '${REQALL_URL}/mcp')
    assert.equal(server.headers.Authorization, 'Bearer ${REQALL_API_KEY}')
    const dumped = JSON.stringify(mcp)
    assert.doesNotMatch(dumped, /sk-[A-Za-z0-9]{20,}/)
    assert.doesNotMatch(dumped, /Bearer [A-Za-z0-9._-]{16,}/)
  })

  it('Cursor example uses env interpolation, not a literal key', () => {
    const example = JSON.parse(read('examples/cursor-mcp.json'))
    const server = example.mcpServers.reqall
    assert.equal(server.url, 'https://www.reqall.net/mcp')
    assert.equal(server.headers.Authorization, 'Bearer ${env:REQALL_API_KEY}')
  })

  it('Cursor plugin manifest declares the API key variable', () => {
    const manifest = JSON.parse(read('.cursor-plugin/plugin.json'))
    assert.equal(manifest.name, 'reqall')
    assert.equal(manifest.version, JSON.parse(read('package.json')).version)
    assert.equal(manifest.license, 'MIT')
    assert.ok(manifest.keywords.includes('grok-bot'))
    assert.doesNotMatch(manifest.description, /Grok Build/)
    const vars = manifest.variables
    assert.equal(vars.type, 'object')
    assert.ok(vars.properties.REQALL_API_KEY)
    assert.ok(!(vars.required || []).includes('REQALL_API_KEY'))
    assert.equal(vars.properties.REQALL_URL.default, 'https://www.reqall.net')
  })

  it('AGENTS.md encodes context-before-work, persist-before-done, and no secrets', () => {
    const agents = read('AGENTS.md')
    assert.match(agents, /before implementation/i)
    assert.match(agents, /Persist completed work before ending the turn/)
    assert.match(agents, /Never persist secrets/)
    assert.match(agents, /no SessionStart \/ Stop \/ PreToolUse hook runtime/)
    assert.match(agents, /Prefer native MCP OAuth/)
    assert.match(agents, /2026-08-28/)
    assert.match(agents, /fallback/)
    assert.match(agents, /reqall login/)
    assert.match(agents, /call `list_links` and `impact`/)
    assert.match(agents, /call `search` first/)
    assert.match(agents, /record_id/)
    assert.match(agents, /subscribe_project/)
    assert.match(agents, /poll_subscriptions/)
    assert.match(agents, /unsubscribe_project/)
    assert.match(agents, /list_subscriptions/)
    assert.match(agents, /list_projects/)
    assert.match(agents, /list_shares/)
    assert.match(agents, /merge_projects/)
    assert.match(agents, /\.machine\/<hostname>\/<os-user>/)
    assert.match(agents, /reqall-intend/)
    assert.match(agents, /Never tell the user/)
    assert.doesNotMatch(agents, /Do not try Cursor OAuth/)
    assert.doesNotMatch(agents, /not yet on Reqall|Until Reqall registers|invalid redirect_uri/)
    for (const skill of REQUIRED_SKILLS) {
      assert.ok(agents.includes(skill), `AGENTS.md should name ${skill}`)
    }
  })

  it('README is a real Grok Bot install guide', () => {
    const readme = read('README.md')
    assert.ok(readme.length > 1500, 'README is still a stub')
    assert.match(readme, /Grok Bot/)
    assert.match(readme, /REQALL_API_KEY/)
    assert.match(readme, /REQALL_URL/)
    assert.match(readme, /REQALL_PROJECT_NAME/)
    assert.match(readme, /REQALL_POLL_INTERVAL_MIN/)
    assert.match(readme, /\.machine\/<hostname>\/<os-user>/)
    assert.match(readme, /inline `links\[]`/)
    assert.match(readme, /subscribe_project/)
    assert.match(readme, /intentionally skipped/)
    assert.match(readme, /https:\/\/www\.reqall\.net\/mcp/)
    assert.match(readme, /Native MCP OAuth is the preferred path/)
    assert.match(readme, /2026-08-28/)
    assert.match(readme, /cursor:\/\/anysphere\.cursor-mcp\/oauth\/callback/)
    assert.match(readme, /http:\/\/localhost:8787\/callback/)
    assert.match(readme, /https:\/\/www\.cursor\.com\/agents\/mcp\/oauth\/callback/)
    assert.match(readme, /reference for other hosts/)
    assert.match(readme, /fallback/)
    assert.match(readme, /reqall login/)
    assert.match(readme, /npm test/)
    assert.doesNotMatch(readme, /invalid redirect_uri/)
    assert.doesNotMatch(readme, /not yet on Reqall|Until those URIs|Until Reqall registers|currently fails/)
    for (const skill of REQUIRED_SKILLS) {
      assert.ok(readme.includes(skill), `README should document ${skill}`)
    }
    assert.match(readme, /Do not run `grok plugin marketplace add`/)
    assert.match(readme, /do not[\s\S]*~\/\.grok\/config\.toml/i)
    assert.match(
      readme,
      /mkdir -p ~\/\.cursor\/plugins\/local\nln -sfn "\$PWD\/grok-bot-plugin" ~\/\.cursor\/plugins\/local\/reqall/,
      'local plugin install must mkdir the parent before ln'
    )
  })

  it('treats native MCP OAuth as working, with API key as fallback', () => {
    const forbidden = /OAuth is broken|OAuth-only setup is unsupported|Cursor OAuth against \/mcp is not supported|Do not use OAuth-only setup|Grok Bot has no OAuth|current Grok Bot workaround|not yet on Reqall|Until those URIs are registered|Until Reqall registers/i
    const sources = [
      'README.md',
      'AGENTS.md',
      '.cursor-plugin/plugin.json',
      'package.json'
    ]
    for (const rel of sources) {
      assert.doesNotMatch(read(rel), forbidden, `${rel} still has stale OAuth wording`)
    }
    const readme = read('README.md')
    assert.match(readme, /Native MCP OAuth is the preferred path and works/)
    const keyDesc = JSON.parse(read('.cursor-plugin/plugin.json')).variables.properties.REQALL_API_KEY.description
    assert.match(keyDesc, /fallback/)
    assert.match(keyDesc, /Prefer native MCP OAuth/)
    assert.doesNotMatch(keyDesc, /workaround|not supported/)
  })

  it('is skills + MCP + docs, not a hook runtime or Grok Build package', () => {
    assert.equal(existsSync(join(root, 'hooks')), false)
    assert.equal(existsSync(join(root, 'scripts', 'reqall-hook.mjs')), false)
    assert.equal(existsSync(join(root, 'config.toml.example')), false)
    const pkg = JSON.parse(read('package.json'))
    assert.equal(pkg.name, '@reqall/grok-bot-plugin')
    assert.ok(!JSON.stringify(pkg).includes('grok-build'))
  })

  it('keeps the MIT license and does not commit secrets', () => {
    const license = read('LICENSE')
    assert.match(license, /MIT License/)
    const secretLike = /(?:REQALL_API_KEY|Authorization)\s*[:=]\s*["'](?!\$\{)[^"']+["']/
    for (const file of walkFiles(root)) {
      if (file.endsWith('.js') && file.includes(`${join('test')}`)) continue
      const text = readFileSync(file, 'utf8')
      assert.doesNotMatch(text, secretLike, `${file} looks like it contains a secret assignment`)
      assert.doesNotMatch(text, /sk-[A-Za-z0-9]{24,}/, `${file} looks like a live key`)
    }
  })
})
