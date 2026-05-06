// minimal YAML frontmatter parser - supports the subset skills actually need:
// scalar string fields, optionally quoted, with line continuations folded out.
// good enough for `name`, `description`, and a few flags. avoids a yaml dep.

const FENCE = '---'

export function parseFrontmatter(content) {
  if (!content.startsWith(FENCE)) return null
  // require the fence to be on its own line (next char is newline)
  if (content[3] !== '\n' && content[3] !== '\r') return null

  const endIdx = findClosingFence(content, 3)
  if (endIdx === -1) return null

  const raw = content.slice(3, endIdx).replace(/^\r?\n/, '')
  const body = content.slice(endIdx + FENCE.length).replace(/^\r?\n/, '')

  const data = parseSimpleYaml(raw)
  return { data, body, raw }
}

function findClosingFence(s, from) {
  // closing fence must be at start of a line and followed by EOL or EOF
  const re = /(^|\n)---(\r?\n|$)/g
  re.lastIndex = from
  const m = re.exec(s)
  if (!m) return -1
  return m.index + (m[1] ? 1 : 0)
}

function parseSimpleYaml(raw) {
  const data = {}
  const lines = raw.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line || /^\s*#/.test(line)) {
      i++
      continue
    }
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/)
    if (!m) {
      i++
      continue
    }
    const key = m[1]
    let valueRaw = m[2]
    // folded scalar (>) or literal block (|) - take following indented lines
    if (valueRaw === '>' || valueRaw === '|') {
      const folded = valueRaw === '>'
      const collected = []
      i++
      while (i < lines.length && /^\s+/.test(lines[i])) {
        collected.push(lines[i].replace(/^\s+/, ''))
        i++
      }
      data[key] = folded ? collected.join(' ') : collected.join('\n')
      continue
    }
    data[key] = unquote(valueRaw.trim())
    i++
  }
  return data
}

function unquote(v) {
  if (v.length >= 2) {
    const first = v[0]
    const last = v[v.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1)
    }
  }
  return v
}

// validates the minimum SKILL.md contract shared by Claude Code + Codex.
export function isValidSkillFrontmatter(data) {
  if (!data) return false
  if (typeof data.name !== 'string' || !data.name.trim()) return false
  if (typeof data.description !== 'string' || !data.description.trim()) return false
  return true
}
