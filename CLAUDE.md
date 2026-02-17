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
yarn test              # Run all tests
```

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
- [docs/index.md](./docs/index.md) - Complete documentation index
