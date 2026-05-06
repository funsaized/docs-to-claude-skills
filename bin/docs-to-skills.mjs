#!/usr/bin/env node
// CLI entry. uses node:util parseArgs - zero deps.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { generateSkills } from '../src/generate.mjs'
import { TARGETS } from '../src/targets.mjs'
import { c } from '../src/log.mjs'

const HELP = `${c.bold('docs-to-skills')} - generate Claude Code & OpenAI Codex skills from docs/*.md

${c.bold('USAGE')}
  docs-to-skills [command] [options]

${c.bold('COMMANDS')}
  generate              Generate skills (default)
  init                  Scaffold docs/example.md and a sample skill template

${c.bold('OPTIONS')}
  --docs <dir>          Source docs directory (default: ./docs)
  --target <t>          claude | codex | both (default: both)
                        Or comma-separated, e.g. --target claude,codex
  --mode <m>            symlink | copy (default: symlink)
  --clean               Remove all managed skills before regenerating
  --dry-run             Print actions without modifying the filesystem
  --quiet               Suppress per-file output
  --cwd <dir>           Project root (default: process.cwd())
  -h, --help            Show this help

${c.bold('EXAMPLES')}
  docs-to-skills                            # generate for both runtimes
  docs-to-skills --target claude            # only Claude Code
  docs-to-skills --target codex --mode copy # Codex, copy instead of symlink
  docs-to-skills --clean                    # nuke + regenerate
  docs-to-skills --dry-run                  # preview actions

${c.bold('OUTPUT')}
  ${TARGETS.claude.dir.join('/')}/<skill-name>/SKILL.md   ${c.dim('(Claude Code)')}
  ${TARGETS.codex.dir.join('/')}/<skill-name>/SKILL.md    ${c.dim('(OpenAI Codex)')}

Each <skill-name> comes from the ${c.bold('name:')} field in the doc's YAML frontmatter.
Docs without ${c.bold('name')} + ${c.bold('description')} frontmatter are skipped.
`

const argv = process.argv.slice(2)
const command = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'generate'
const rest = command === argv[0] ? argv.slice(1) : argv

let parsed
try {
  parsed = parseArgs({
    args: rest,
    options: {
      help: { type: 'boolean', short: 'h' },
      docs: { type: 'string' },
      target: { type: 'string' },
      mode: { type: 'string' },
      clean: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      quiet: { type: 'boolean' },
      cwd: { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  })
} catch (err) {
  console.error(c.red(`error: ${err.message}`))
  console.error(`run ${c.bold('docs-to-skills --help')} for usage`)
  process.exit(1)
}

const { values } = parsed

if (values.help) {
  console.info(HELP)
  process.exit(0)
}

if (command === 'init') {
  initRepo({ cwd: values.cwd ? resolve(values.cwd) : process.cwd() })
  process.exit(0)
}

if (command !== 'generate') {
  console.error(c.red(`unknown command: ${command}`))
  console.error(HELP)
  process.exit(1)
}

try {
  console.info()
  console.info(c.bold(c.cyan('docs-to-skills')))
  console.info()
  const stats = await generateSkills({
    cwd: values.cwd,
    docsDir: values.docs,
    targets: values.target,
    mode: values.mode,
    clean: values.clean,
    dryRun: values['dry-run'],
    quiet: values.quiet,
  })
  console.info()
  console.info(c.bold('summary:'))
  if (stats.created > 0) console.info(`  ${c.green(`${stats.created} created`)}`)
  if (stats.updated > 0) console.info(`  ${c.cyan(`${stats.updated} updated`)}`)
  if (stats.unchanged > 0) console.info(`  ${c.dim(`${stats.unchanged} unchanged`)}`)
  if (stats.skipped > 0)
    console.info(`  ${c.yellow(`${stats.skipped} skipped`)} ${c.dim('(missing frontmatter)')}`)
  if (stats.removed > 0) console.info(`  ${c.red(`${stats.removed} removed`)}`)
  if (
    stats.created === 0 &&
    stats.updated === 0 &&
    stats.unchanged === 0 &&
    stats.skipped === 0 &&
    stats.removed === 0
  ) {
    console.info(c.dim('  nothing to do'))
  }
  console.info()
} catch (err) {
  console.error(c.red(`error: ${err.message}`))
  if (process.env.DEBUG) console.error(err.stack)
  process.exit(1)
}

function initRepo({ cwd }) {
  const docsDir = join(cwd, 'docs')
  const file = join(docsDir, 'example.md')
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true })
  if (existsSync(file)) {
    console.info(c.yellow(`docs/example.md already exists - leaving it alone`))
    return
  }
  writeFileSync(
    file,
    `---
name: example-skill
description: Use this skill when the user asks for an example, demo, or sample of how docs-to-skills works.
---

# Example skill

This file lives in \`docs/example.md\`. Running \`docs-to-skills generate\` will
materialize it as:

- \`.claude/skills/example-skill/SKILL.md\` (Claude Code)
- \`.agents/skills/example-skill/SKILL.md\` (OpenAI Codex)

Edit this body to teach the agent what to do when the description matches a
user request. The frontmatter \`description\` is what triggers activation, so
write it with concrete keywords your team uses.
`,
  )
  console.info(c.green(`+ created ${file}`))
  console.info(c.dim(`  next: docs-to-skills generate`))
}
