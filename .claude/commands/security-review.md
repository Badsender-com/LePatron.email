---
allowed-tools: Read, Grep, Glob, Bash
description: Security-focused review of code changes
---

Perform a security audit of the changes, following `.claude/agents/security-auditor.md`. Target: $ARGUMENTS (a PR number, or empty for the current branch).

Commits on the branch, and uncommitted changes:
!`git log --oneline origin/develop..HEAD`
!`git diff --stat HEAD`

Read the whole diff against the base branch: `gh pr diff <n>` for a PR, `git diff origin/<base>...HEAD` otherwise. Do not check out or switch branches.

Check, in this order:

1. Authorization: the capability of each route that writes, the scope of each resource an id names, escalation through account management. If the diff touches rights (`docs/agents/rights-review.md`, section "When it applies"), run that review and include its table for every role.
2. Injection, XSS, input validation.
3. Hardcoded secrets, data exposed in responses or logs.

Report findings by severity with specific remediation steps. The repository is public: findings go to the user, and nothing meant for GitHub explains how to exploit a gap.
