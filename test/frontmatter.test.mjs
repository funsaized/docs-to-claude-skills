import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isValidSkillFrontmatter, parseFrontmatter } from '../src/frontmatter.mjs'

test('parses minimal frontmatter', () => {
  const fm = parseFrontmatter('---\nname: foo\ndescription: bar\n---\nbody\n')
  assert.equal(fm.data.name, 'foo')
  assert.equal(fm.data.description, 'bar')
  assert.equal(fm.body, 'body\n')
})

test('handles quoted values', () => {
  const fm = parseFrontmatter(`---\nname: "foo"\ndescription: 'multi word desc'\n---\n`)
  assert.equal(fm.data.name, 'foo')
  assert.equal(fm.data.description, 'multi word desc')
})

test('returns null without opening fence', () => {
  assert.equal(parseFrontmatter('# just a heading\n'), null)
})

test('returns null without closing fence', () => {
  assert.equal(parseFrontmatter('---\nname: foo\nstill open'), null)
})

test('supports folded scalar with >', () => {
  const fm = parseFrontmatter(
    `---\nname: foo\ndescription: >\n  line one\n  line two\n---\n`,
  )
  assert.equal(fm.data.description, 'line one line two')
})

test('isValidSkillFrontmatter requires both fields', () => {
  assert.equal(isValidSkillFrontmatter({ name: 'a', description: 'b' }), true)
  assert.equal(isValidSkillFrontmatter({ name: 'a' }), false)
  assert.equal(isValidSkillFrontmatter({ description: 'b' }), false)
  assert.equal(isValidSkillFrontmatter(null), false)
  assert.equal(isValidSkillFrontmatter({ name: '   ', description: 'b' }), false)
})

test('ignores comment-only lines', () => {
  const fm = parseFrontmatter('---\n# leading comment\nname: foo\ndescription: bar\n---\n')
  assert.equal(fm.data.name, 'foo')
})
