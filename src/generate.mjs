import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { isValidSkillFrontmatter, parseFrontmatter } from './frontmatter.mjs'
import { resolveTargets, targetSkillsDir } from './targets.mjs'
import { c } from './log.mjs'

/**
 * @typedef {Object} GenerateOptions
 * @property {string} [cwd]            project root (default: process.cwd())
 * @property {string} [docsDir]        source docs directory, absolute or relative to cwd (default: 'docs')
 * @property {('claude'|'codex')[]|'both'|string} [targets]  which agent runtimes to emit for (default: 'both')
 * @property {'symlink'|'copy'} [mode] how to materialize SKILL.md (default: 'symlink' with copy fallback)
 * @property {boolean} [clean]         remove all managed skills under each target before regenerating
 * @property {boolean} [dryRun]        print actions but do not modify the filesystem
 * @property {boolean} [quiet]         suppress per-file output
 * @property {(line: string) => void} [logger]  override output sink (default: console.info)
 */

/**
 * @typedef {Object} GenerateStats
 * @property {number} created      new SKILL.md files created
 * @property {number} updated      existing SKILL.md replaced (target changed)
 * @property {number} unchanged    already in sync, no work
 * @property {number} skipped      docs without valid frontmatter
 * @property {number} removed      stale managed skills cleaned up
 * @property {Array<{name:string,target:string,action:string,source:string}>} actions
 */

const ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  UNCHANGED: 'unchanged',
  REMOVE: 'remove',
  SKIP: 'skip',
}

/**
 * Generate Claude Code and/or OpenAI Codex skills from a docs/ directory.
 * @param {GenerateOptions} [opts]
 * @returns {Promise<GenerateStats>}
 */
export async function generateSkills(opts = {}) {
  const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd()
  const docsDir = resolveDocsDir(cwd, opts.docsDir ?? 'docs')
  const targets = resolveTargets(opts.targets ?? 'both')
  const mode = opts.mode ?? 'symlink'
  if (mode !== 'symlink' && mode !== 'copy') {
    throw new Error(`invalid mode "${mode}" - expected symlink or copy`)
  }
  const clean = !!opts.clean
  const dryRun = !!opts.dryRun
  const quiet = !!opts.quiet
  const log = opts.logger ?? ((line) => console.info(line))

  const stats = /** @type {GenerateStats} */ ({
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    removed: 0,
    actions: [],
  })

  if (!existsSync(docsDir)) {
    if (!quiet) log(c.yellow(`docs directory not found: ${docsDir}`))
    return stats
  }

  const docs = collectDocs(docsDir)
  if (docs.length === 0 && !quiet) {
    log(c.yellow(`no .md files in ${docsDir}`))
  }

  for (const targetId of targets) {
    const skillsDir = targetSkillsDir(cwd, targetId)
    if (clean) {
      cleanManagedSkills(skillsDir, docsDir, dryRun, (action) => {
        stats.removed++
        stats.actions.push({ ...action, target: targetId })
        if (!quiet) log(formatAction(action, targetId))
      })
    }
    if (!dryRun && !existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true })
    }

    const expected = new Set()
    for (const doc of docs) {
      const fm = doc.frontmatter
      if (!isValidSkillFrontmatter(fm?.data)) {
        // skip is global, not per-target - only count once
        if (targetId === targets[0]) {
          stats.skipped++
          const action = {
            name: doc.basename,
            action: ACTION.SKIP,
            source: doc.path,
            reason: 'missing skill frontmatter (need name + description)',
          }
          stats.actions.push({ ...action, target: 'all' })
          if (!quiet) log(formatAction(action, 'all'))
        }
        continue
      }
      const skillName = fm.data.name.trim()
      expected.add(skillName)
      const skillDir = join(skillsDir, skillName)
      const skillFile = join(skillDir, 'SKILL.md')

      const action = applySkill({
        skillDir,
        skillFile,
        sourcePath: doc.path,
        sourceContent: doc.content,
        mode,
        dryRun,
      })

      if (action === ACTION.CREATE) stats.created++
      else if (action === ACTION.UPDATE) stats.updated++
      else if (action === ACTION.UNCHANGED) stats.unchanged++

      const entry = { name: skillName, action, source: doc.path }
      stats.actions.push({ ...entry, target: targetId })
      if (!quiet) log(formatAction(entry, targetId))
    }

    // prune stale managed skills under this target (in case docs were renamed/removed)
    pruneStaleManagedSkills(skillsDir, docsDir, expected, dryRun, (action) => {
      stats.removed++
      stats.actions.push({ ...action, target: targetId })
      if (!quiet) log(formatAction(action, targetId))
    })
  }

  return stats
}

function resolveDocsDir(cwd, docsDir) {
  return isAbsolute(docsDir) ? docsDir : join(cwd, docsDir)
}

function collectDocs(docsDir) {
  const out = []
  for (const file of readdirSync(docsDir)) {
    if (!file.endsWith('.md')) continue
    const path = join(docsDir, file)
    const stat = lstatSync(path)
    if (!stat.isFile()) continue
    const content = readFileSync(path, 'utf8')
    out.push({
      path,
      basename: file.replace(/\.md$/, ''),
      content,
      frontmatter: parseFrontmatter(content),
    })
  }
  return out
}

function applySkill({ skillDir, skillFile, sourcePath, sourceContent, mode, dryRun }) {
  if (!dryRun && !existsSync(skillDir)) mkdirSync(skillDir, { recursive: true })

  // read current state of skillFile (link target or content)
  let current = null
  try {
    const stat = lstatSync(skillFile)
    if (stat.isSymbolicLink()) {
      const link = readlinkSync(skillFile)
      const resolved = resolve(dirname(skillFile), link)
      current = { kind: 'symlink', resolved }
    } else if (stat.isFile()) {
      current = { kind: 'file', content: readFileSync(skillFile, 'utf8') }
    }
  } catch {
    // missing
  }

  // figure out the desired state
  if (mode === 'symlink') {
    const expectedTarget = resolve(sourcePath)
    if (current?.kind === 'symlink' && current.resolved === expectedTarget) {
      return ACTION.UNCHANGED
    }
    if (dryRun) return current ? ACTION.UPDATE : ACTION.CREATE
    if (current) unlinkSync(skillFile)
    const rel = relative(dirname(skillFile), sourcePath)
    try {
      symlinkSync(rel, skillFile)
    } catch (err) {
      // fallback to copy on platforms / FS that disallow symlinks (Windows w/o dev mode)
      if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
        copyFileSync(sourcePath, skillFile)
      } else {
        throw err
      }
    }
    return current ? ACTION.UPDATE : ACTION.CREATE
  }

  // mode === 'copy'
  if (current?.kind === 'file' && current.content === sourceContent) {
    return ACTION.UNCHANGED
  }
  if (dryRun) return current ? ACTION.UPDATE : ACTION.CREATE
  if (current) unlinkSync(skillFile)
  copyFileSync(sourcePath, skillFile)
  return current ? ACTION.UPDATE : ACTION.CREATE
}

function cleanManagedSkills(skillsDir, docsDir, dryRun, report) {
  if (!existsSync(skillsDir)) return
  for (const dir of readdirSync(skillsDir)) {
    const full = join(skillsDir, dir)
    if (isManagedByDocs(full, docsDir)) {
      if (!dryRun) rmSync(full, { recursive: true, force: true })
      report({ name: dir, action: ACTION.REMOVE, source: docsDir, reason: 'clean' })
    }
  }
}

function pruneStaleManagedSkills(skillsDir, docsDir, expected, dryRun, report) {
  if (!existsSync(skillsDir)) return
  for (const dir of readdirSync(skillsDir)) {
    if (expected.has(dir)) continue
    const full = join(skillsDir, dir)
    if (!isManagedByDocs(full, docsDir)) continue
    // safe to remove: this skill's SKILL.md links into docsDir, so we created it
    const skillFile = join(full, 'SKILL.md')
    if (!dryRun) {
      try {
        unlinkSync(skillFile)
      } catch {}
      try {
        if (existsSync(full) && readdirSync(full).length === 0) rmdirSync(full)
      } catch {}
    }
    report({ name: dir, action: ACTION.REMOVE, source: docsDir, reason: 'stale' })
  }
}

function isManagedByDocs(skillDirPath, docsDir) {
  const skillFile = join(skillDirPath, 'SKILL.md')
  try {
    const stat = lstatSync(skillFile)
    if (!stat.isSymbolicLink()) return false
    const link = readlinkSync(skillFile)
    const resolved = resolve(dirname(skillFile), link)
    const docsAbs = resolve(docsDir)
    return resolved === docsAbs || resolved.startsWith(docsAbs + '/')
  } catch {
    return false
  }
}

function formatAction(a, target) {
  const targetLabel = target === 'all' ? c.dim('all') : c.dim(`[${target}]`)
  switch (a.action) {
    case ACTION.CREATE:
      return `  ${c.green('+')} ${a.name} ${targetLabel}`
    case ACTION.UPDATE:
      return `  ${c.cyan('~')} ${a.name} ${targetLabel}`
    case ACTION.UNCHANGED:
      return `  ${c.dim('=')} ${a.name} ${targetLabel} ${c.dim('(unchanged)')}`
    case ACTION.REMOVE:
      return `  ${c.red('-')} ${a.name} ${targetLabel} ${c.dim(`(${a.reason ?? 'removed'})`)}`
    case ACTION.SKIP:
      return `  ${c.yellow('!')} ${a.name} ${targetLabel} ${c.dim(`(skipped: ${a.reason ?? ''})`)}`
    default:
      return `  ${a.action} ${a.name} ${targetLabel}`
  }
}

export { ACTION }
