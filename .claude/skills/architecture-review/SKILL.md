---
name: architecture-review
description: Architectural analysis of code changes
---

Analyze the architectural impact of recent changes.

Changes to review:
!`git diff --name-only`

For each modified file, consider:

1. Does it follow existing patterns?
2. Are dependencies appropriate?
3. Is the module boundary respected?
4. Will this scale?

Provide architectural recommendations with trade-offs.
