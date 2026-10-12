# CLAUDE.md

For project instructions and code review guidelines, see [AGENTS.md](./AGENTS.md).

## Claude Code Commands

After developing a feature:

```
/review                # General code review
/architecture-review   # Architecture analysis
/security-review       # Security audit
```

Before committing code:

```
yarn code:lint         # Check for linting errors
yarn code:fix          # Auto-fix errors and format code
yarn test-ci           # Run all tests (yarn test is jest --watch, it never exits)
```

## Claude Code Skills

Agent skills in `.claude/skills/` (not the product's AI Skills feature).

| Skill             | Use for                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `git-sync`        | Keeping the branch rebased on its base with a clean worktree                   |
| `grill-with-docs` | Step 1 of a new feature: grill the design, write the ADR and `GLOSSARY.md`     |
| `to-prd`          | Step 2: publish the PRD as a `⛰ Epic` issue                                    |
| `to-issues`       | Step 3: split the epic into tracer-bullet sub-issues with blocking edges       |
| `tdd`             | Steps 4–5: the ADR + skipped tests first PR, then red → green ticket by ticket |
| `grilling`        | The interview loop alone, to stress-test any plan                              |
| `domain-modeling` | Sharpening vocabulary, editing `GLOSSARY.md` or an ADR                         |

A new feature always starts with `/grill-with-docs`: see "New Feature Workflow" in [AGENTS.md](./AGENTS.md). The skills are adapted from [mattpocock/skills](https://github.com/mattpocock/skills), see [.claude/skills/CREDITS.md](./.claude/skills/CREDITS.md).

## Available Subagents

| Agent              | Use for                        |
| ------------------ | ------------------------------ |
| `code-reviewer`    | Critical code review           |
| `architect`        | Architecture and design        |
| `security-auditor` | Security vulnerabilities       |
| `ux-reviewer`      | UX/UI design system compliance |

## Additional Documentation

- [AGENTS.md](./AGENTS.md) - Technical guidelines and conventions
- [docs/AI_POLICIES.md](./docs/AI_POLICIES.md) - PR structure and quality standards
- [docs/UX_GUIDELINES.md](./docs/UX_GUIDELINES.md) - UI/UX design system guidelines
- [docs/adr/](./docs/adr/) - Architecture Decision Records
- [docs/index.md](./docs/index.md) - Complete documentation index
