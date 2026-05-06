---
name: docs-to-skills-usage
description: How to use the docs-to-skills tool. Triggers when the user asks "how do I run docs-to-skills", "regenerate skills", "add a new skill", "skills not showing up", or works in a repo containing a docs/ directory plus .claude/skills/ or .agents/skills/.
---

# docs-to-skills usage

This repo turns markdown files in `docs/` into agent skills for both
Claude Code and OpenAI Codex by maintaining symlinks under
`.claude/skills/` and `.agents/skills/`.

## Adding a new skill

1. Create `docs/<your-name>.md` with frontmatter:
   ```
   ---
   name: my-skill
   description: When this skill should activate. Be concrete about keywords.
   ---
   ```
2. Run `docs-to-skills generate` (or `npm run example` in this repo).
3. Restart the agent if it doesn't auto-detect the new skill.

## Renaming or removing a skill

Edit the `name:` field or delete the doc, then re-run `docs-to-skills generate`.
Stale managed entries are pruned automatically — only entries whose `SKILL.md`
links into the docs directory are touched, so unrelated skills are safe.

## Common flags

- `--target claude` or `--target codex` to write only one runtime
- `--mode copy` if symlinks aren't allowed on your filesystem
- `--clean` to nuke and rebuild
- `--dry-run` to preview
