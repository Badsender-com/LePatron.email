---
allowed-tools: Read, Grep, Glob, Bash
description: Critical code review of recent changes following AGENTS.md guidelines
---

Review the changes following the Code Review Guidelines in AGENTS.md. Target: $ARGUMENTS (a PR number, or empty for the current branch).

Commits on the branch, and uncommitted changes:
!`git log --oneline origin/develop..HEAD`
!`git diff --stat HEAD`

Read the whole diff against the base branch: `gh pr diff <n>` for a PR, `git diff origin/<base>...HEAD` otherwise (the base is the PR's, which may be another feature branch). Do not check out or switch branches.

If the diff touches rights (`docs/agents/rights-review.md`, section "When it applies"), run that review and include its table for every role.

Provide feedback using the Review Output Format from AGENTS.md. Focus on CRITICAL and HIGH issues first.
