import { strict as assert } from 'node:assert'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { generateSkills } from '../src/generate.mjs'

let dir
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'd2s-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeDoc(name, frontmatter, body = 'hello\n') {
  const docsDir = join(dir, 'docs')
  mkdirSync(docsDir, { recursive: true })
  const file = join(docsDir, `${name}.md`)
  mkdirSync(dirname(file), { recursive: true })
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  writeFileSync(file, `---\n${fm}\n---\n${body}`)
}

test('generates symlinks for both targets', async () => {
  writeDoc('alpha', { name: 'alpha-skill', description: 'use alpha' })
  const stats = await generateSkills({ cwd: dir, quiet: true })
  assert.equal(stats.created, 2) // claude + codex
  assert.equal(stats.skipped, 0)

  for (const sub of ['.claude/skills', '.agents/skills']) {
    const file = join(dir, sub, 'alpha-skill', 'SKILL.md')
    assert.ok(existsSync(file), `expected ${file} to exist`)
    const stat = lstatSync(file)
    assert.ok(stat.isSymbolicLink(), `expected ${file} to be a symlink`)
    const link = readlinkSync(file)
    const resolved = resolve(dirname(file), link)
    assert.equal(resolved, join(dir, 'docs', 'alpha.md'))
  }
})

test('generates skills from nested docs with frontmatter', async () => {
  writeDoc('guides/beta', { name: 'beta-skill', description: 'use beta' })
  const stats = await generateSkills({ cwd: dir, quiet: true })
  assert.equal(stats.created, 2)
  assert.equal(stats.skipped, 0)

  for (const sub of ['.claude/skills', '.agents/skills']) {
    const file = join(dir, sub, 'beta-skill', 'SKILL.md')
    assert.ok(existsSync(file), `expected ${file} to exist`)
    const stat = lstatSync(file)
    assert.ok(stat.isSymbolicLink(), `expected ${file} to be a symlink`)
    const link = readlinkSync(file)
    const resolved = resolve(dirname(file), link)
    assert.equal(resolved, join(dir, 'docs', 'guides', 'beta.md'))
  }
})

test('second run reports unchanged', async () => {
  writeDoc('alpha', { name: 'alpha-skill', description: 'use alpha' })
  await generateSkills({ cwd: dir, quiet: true })
  const stats = await generateSkills({ cwd: dir, quiet: true })
  assert.equal(stats.created, 0)
  assert.equal(stats.unchanged, 2)
})

test('skips docs without valid frontmatter', async () => {
  writeDoc('valid', { name: 'good', description: 'ok' })
  // no frontmatter at all
  writeFileSync(join(dir, 'docs', 'naked.md'), '# just a heading\n')
  const stats = await generateSkills({ cwd: dir, quiet: true })
  assert.equal(stats.created, 2)
  assert.equal(stats.skipped, 1)
})

test('--target claude only writes .claude/skills', async () => {
  writeDoc('alpha', { name: 'alpha-skill', description: 'use alpha' })
  await generateSkills({ cwd: dir, targets: 'claude', quiet: true })
  assert.ok(existsSync(join(dir, '.claude/skills/alpha-skill/SKILL.md')))
  assert.ok(!existsSync(join(dir, '.agents/skills/alpha-skill/SKILL.md')))
})

test('copy mode writes a regular file with body content', async () => {
  writeDoc('alpha', { name: 'alpha-skill', description: 'use alpha' }, 'body!\n')
  await generateSkills({ cwd: dir, mode: 'copy', quiet: true })
  const file = join(dir, '.claude/skills/alpha-skill/SKILL.md')
  const stat = lstatSync(file)
  assert.equal(stat.isSymbolicLink(), false)
  const content = readFileSync(file, 'utf8')
  assert.match(content, /body!/)
  assert.match(content, /name: alpha-skill/)
})

test('renaming a doc prunes the stale skill dir', async () => {
  writeDoc('alpha', { name: 'old-name', description: 'x' })
  await generateSkills({ cwd: dir, quiet: true })
  assert.ok(existsSync(join(dir, '.claude/skills/old-name/SKILL.md')))

  // rewrite with new name
  writeDoc('alpha', { name: 'new-name', description: 'x' })
  const stats = await generateSkills({ cwd: dir, quiet: true })
  assert.ok(existsSync(join(dir, '.claude/skills/new-name/SKILL.md')))
  assert.ok(!existsSync(join(dir, '.claude/skills/old-name/SKILL.md')))
  assert.ok(stats.removed >= 2) // both targets pruned
})

test('does not touch unrelated skill dirs not managed by us', async () => {
  // pre-existing skill not from docs
  const foreignDir = join(dir, '.claude/skills/foreign-skill')
  mkdirSync(foreignDir, { recursive: true })
  writeFileSync(join(foreignDir, 'SKILL.md'), '---\nname: foreign-skill\ndescription: external\n---\n')

  writeDoc('alpha', { name: 'alpha-skill', description: 'x' })
  await generateSkills({ cwd: dir, clean: true, quiet: true })

  assert.ok(existsSync(join(foreignDir, 'SKILL.md')), 'foreign skill must survive --clean')
  assert.ok(existsSync(join(dir, '.claude/skills/alpha-skill/SKILL.md')))
})

test('dry-run does not modify the filesystem', async () => {
  writeDoc('alpha', { name: 'alpha-skill', description: 'x' })
  const stats = await generateSkills({ cwd: dir, dryRun: true, quiet: true })
  assert.equal(stats.created, 2)
  assert.ok(!existsSync(join(dir, '.claude/skills/alpha-skill/SKILL.md')))
})
