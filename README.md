# docs-to-claude-skills

[![npm version](https://img.shields.io/npm/v/docs-to-claude-skills.svg)](https://www.npmjs.com/package/docs-to-claude-skills)
[![npm downloads](https://img.shields.io/npm/dm/docs-to-claude-skills.svg)](https://www.npmjs.com/package/docs-to-claude-skills)
[![license](https://img.shields.io/npm/l/docs-to-claude-skills.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/docs-to-claude-skills.svg)](https://nodejs.org)

> One markdown file. Two AI agents. Zero duplication.

Author your team's agent skills as plain markdown anywhere under `docs/`, and have them
materialize as both [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills)
and [OpenAI Codex skills](https://developers.openai.com/codex/skills) — kept
in sync automatically via symlinks.

```
docs/database.md  ──┬──▶  .claude/skills/database/SKILL.md   (Claude Code)
                    └──▶  .agents/skills/database/SKILL.md   (OpenAI Codex)
```

Edit the doc once, both agents see the change. No duplicate copies, no
"which version is current" confusion.

---

## Why this exists

Claude Code and OpenAI Codex agree on the SKILL.md contract:

| Field             | Claude Code                          | OpenAI Codex                         |
| ----------------- | ------------------------------------ | ------------------------------------ |
| File              | `SKILL.md`                           | `SKILL.md`                           |
| Required metadata | `name`, `description` (frontmatter)  | `name`, `description` (frontmatter)  |
| Repo location     | `.claude/skills/<name>/`             | `.agents/skills/<name>/`             |

Same file, two locations. Rather than maintain duplicates, keep the canonical
content in `docs/` and let this tool wire up the symlinks. Your existing repo
documentation *becomes* your skill library.

---

## Install

Published on npm: [`docs-to-claude-skills`](https://www.npmjs.com/package/docs-to-claude-skills).
Zero runtime dependencies.

```bash
# project-local (recommended)
npm install --save-dev docs-to-claude-skills

# or with your package manager of choice
pnpm add -D docs-to-claude-skills
yarn add -D docs-to-claude-skills
bun add -d docs-to-claude-skills

# or one-shot, no install
npx docs-to-claude-skills

# or globally
npm install -g docs-to-claude-skills
```

Requires Node.js ≥ 18.

## Quick start

```bash
# 1. install (or use npx)
npm install --save-dev docs-to-claude-skills

# 2. scaffold a starter doc
npx docs-to-skills init

# 3. generate skills for both Claude Code and Codex
npx docs-to-skills
```

That's it. Re-run `npx docs-to-skills` anytime you add or edit a doc.

## Running from source

You don't need to install from npm — the tool has zero runtime dependencies,
so a clone or a direct `npx` from GitHub is enough.

### Option A: one-shot via npx (no clone)

```bash
npx github:funsaized/docs-to-claude-skills --cwd .
```

`npx` fetches the repo, runs the bin, and cleans up. Good for trying it out
or wiring into CI without committing a dependency.

### Option B: clone + run

```bash
git clone https://github.com/funsaized/docs-to-claude-skills.git
cd docs-to-claude-skills
node bin/docs-to-skills.mjs --help
```

Use the `--cwd` flag to target any other project from the clone:

```bash
node /path/to/docs-to-claude-skills/bin/docs-to-skills.mjs --cwd ~/my-project
```

This is handy when you're hacking on the tool itself and want to try changes
against a real repo without publishing.

### Option C: clone + npm link (global `docs-to-skills`)

```bash
git clone https://github.com/funsaized/docs-to-claude-skills.git
cd docs-to-claude-skills
npm link

# now available globally, pointing at your clone
cd ~/my-project
docs-to-skills
```

Edits inside the clone are picked up immediately on the next invocation —
no rebuild step (the source is plain ESM `.mjs`, no compile).

### Running tests

```bash
npm test
```

15 tests under `test/`, all using Node's built-in test runner. No deps to
install.

## Authoring a skill

Drop a markdown file in `docs/` with YAML frontmatter:

```markdown
---
name: postgres-migrations
description: Use when the user asks to add, run, or rollback a database migration. Triggers on "migration", "drizzle", "db:migrate", schema changes.
---

# Postgres migrations

Workflow:

1. Edit `src/database/schema.ts`
2. Run `bun db:add-migration <name>`
3. Run `bun db:migrate`

...
```

Run `docs-to-skills` and it shows up at:
- `.claude/skills/postgres-migrations/SKILL.md`
- `.agents/skills/postgres-migrations/SKILL.md`

The `description` is what each runtime uses to decide *when* to activate the
skill. Be concrete with keywords your team actually says.

---

## Adopting in an existing project

Got a repo with a `docs/` folder full of architecture notes, runbooks, and
how-tos? Most of them already make great agent skills — they just need
frontmatter.

**Step 1.** Add a single dev dependency:

```bash
npm install --save-dev docs-to-claude-skills
```

**Step 2.** Pick the docs you want exposed as skills and add frontmatter to
the top of each one:

```diff
+---
+name: deploy-staging
+description: Use when deploying to staging, debugging deploys, or asked about the staging release process.
+---
 # Deploying to staging
 ...
```

Files without frontmatter are quietly skipped, so you can roll this out
incrementally. Start with two or three high-value docs; add more as you go.

**Step 3.** Add a script to `package.json`:

```json
{
  "scripts": {
    "skills": "docs-to-skills"
  }
}
```

**Step 4.** Ignore the generated directories (they're symlinks, regeneratable):

```gitignore
.claude/skills/
.agents/skills/
```

Or commit them — your call. Symlinks are version-controlled fine on macOS and
Linux. On Windows, prefer `--mode copy` and commit the result.

**Step 5.** Run it locally and in CI:

```bash
npm run skills
```

Wire it into a `postinstall` or pre-commit hook if you want it always fresh:

```json
{
  "scripts": {
    "postinstall": "docs-to-skills --quiet"
  }
}
```

That's the whole adoption path. Existing docs keep working as docs; the ones
with frontmatter additionally become skills.

---

## CLI

```
docs-to-skills [command] [options]

commands
  generate              generate skills (default)
  init                  scaffold docs/example.md

options
  --docs <dir>          source docs directory (default: ./docs)
  --target <t>          claude | codex | both (default: both)
  --mode <m>            symlink | copy (default: symlink)
  --clean               remove all managed skills before regenerating
  --dry-run             preview actions without modifying anything
  --quiet               suppress per-file output
  --cwd <dir>           project root (default: process.cwd())
  -h, --help
```

### Targeting one runtime

```bash
docs-to-skills --target claude       # only .claude/skills/
docs-to-skills --target codex        # only .agents/skills/
docs-to-skills --target claude,codex # both (same as --target both)
```

### Copy instead of symlink

Useful on Windows without developer mode, on filesystems that disallow
symlinks, or when you want to commit the resulting `SKILL.md` files
verbatim:

```bash
docs-to-skills --mode copy
```

Symlink mode is the default and falls back to copy automatically if symlink
creation is denied (`EPERM`/`EACCES`).

### Cleaning up

```bash
docs-to-skills --clean    # nuke and rebuild
```

`--clean` only touches skills whose `SKILL.md` is a symlink pointing into
your `docs/` directory — hand-written or third-party skills under
`.claude/skills/` and `.agents/skills/` are left alone.

---

## Programmatic API

```js
import { generateSkills } from 'docs-to-claude-skills'

const stats = await generateSkills({
  cwd: process.cwd(),
  docsDir: 'docs',
  targets: ['claude', 'codex'],
  mode: 'symlink',
  clean: false,
  dryRun: false,
})

console.log(stats)
// { created: 4, updated: 0, unchanged: 0, skipped: 1, removed: 0, actions: [...] }
```

Other exports:

- `parseFrontmatter(content)` → `{ data, body, raw } | null`
- `isValidSkillFrontmatter(data)` → `boolean`
- `TARGETS` → metadata for the supported runtimes
- `resolveTargets(input)` → normalize a target arg
- `targetSkillsDir(cwd, targetId)` → resolve the output directory

---

## How it works

1. Scan `docs/*.md`.
2. Parse YAML frontmatter; require `name` and `description`.
3. For each target runtime, ensure `<target-dir>/<name>/SKILL.md` is a symlink
   pointing to the source doc. If one exists with the right target, leave it
   (no churn). If wrong, replace it.
4. Prune stale entries — but **only** entries whose `SKILL.md` symlink resolves
   into your `docs/` directory. Anything else is left alone.

The symlink-only-prune rule is what makes this safe to run alongside
hand-authored skills. Your `agent-creator` skill from another plugin won't get
nuked because its `SKILL.md` doesn't link into `docs/`.

---

## FAQ

**Why symlinks?** A copy means you have two sources of truth and one will go
stale. A symlink means edits to `docs/database.md` are instantly visible to
the agent the next time it loads the skill. Use `--mode copy` if your
filesystem or VCS workflow needs literal files.

**Will the agent auto-detect new skills?** Both Claude Code and Codex scan
their skills directories on session start; some pick up changes without a
restart, some don't. If a new skill doesn't show up, restart the session.

**Can the same doc be a skill in one runtime but not the other?** Not via
this tool. The contract is identical between Claude Code and Codex; if you
want runtime-specific instructions, write two docs.

**Does it support nested skill assets (`scripts/`, `references/`)?** Not yet.
Today each skill is a single `SKILL.md`. The directory structure is in place,
so adding sibling files is a small extension.

**Why not just publish a package and `import` skills?** Skills are filesystem
artifacts — agents discover them by scanning conventional paths. This tool
just maintains those paths from a single source.

---

## Prior art / acknowledgments

The single-source-of-truth pattern with symlink-into-docs is taken from the
Tamagui Takeout starter kit's `tko
skills generate` command. This is a generalized, dependency-free
re-implementation that also targets OpenAI Codex.

## License

MIT © funsaized
