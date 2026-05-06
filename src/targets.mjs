// where each agent runtime expects skills.
// claude-code: <repo>/.claude/skills/<name>/SKILL.md
// openai codex: <repo>/.agents/skills/<name>/SKILL.md
// docs:
//   https://docs.claude.com/en/docs/claude-code/skills
//   https://developers.openai.com/codex/skills

import { join } from 'node:path'

export const TARGETS = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    dir: ['.claude', 'skills'],
  },
  codex: {
    id: 'codex',
    label: 'OpenAI Codex',
    dir: ['.agents', 'skills'],
  },
}

export function targetSkillsDir(cwd, targetId) {
  const t = TARGETS[targetId]
  if (!t) throw new Error(`unknown target: ${targetId}`)
  return join(cwd, ...t.dir)
}

export function resolveTargets(input) {
  if (!input || input === 'both') return ['claude', 'codex']
  const ids = String(input)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  for (const id of ids) {
    if (!TARGETS[id]) {
      throw new Error(
        `unknown target "${id}" - expected one of: claude, codex, both`,
      )
    }
  }
  return Array.from(new Set(ids))
}
