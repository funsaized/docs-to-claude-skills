---
name: example-skill
description: Use this skill when the user asks for an example, demo, or sample of how docs-to-skills works. Triggers on "example", "demo", "show me", "sample skill".
---

# Example skill

This file lives at `docs/example.md`. When `docs-to-skills generate` runs,
it materializes a `SKILL.md` for each agent runtime that points back here:

- `.claude/skills/example-skill/SKILL.md` for Claude Code
- `.agents/skills/example-skill/SKILL.md` for OpenAI Codex

The single source of truth is this markdown file. Edit it once; both agents
pick up the change immediately because the generated `SKILL.md` is a symlink.

## How a skill body should read

Write the body as instructions to the agent, not as user-facing docs. Include:

- when the skill should activate (concrete keywords help the runtime route)
- when it should *not* activate (false-positive triggers worth excluding)
- the steps or rules the agent should follow once activated

Keep it tight. Short, specific instructions outperform long prose.
