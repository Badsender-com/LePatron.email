---
name: git-sync
description: Keep the current branch rebased on its base branch and the worktree clean. Use at session start, after each commit, before opening or updating a PR, when a rebase conflicts, or when the user says "rebase", "sync", "am I up to date", "merge main".
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Rebase is maintenance, not a finishing move. Keep a **short leash**: never more than a few base commits behind, never more than one unit of work in the tree.

## Setup, once per session

```bash
git rev-parse --abbrev-ref HEAD                     # abort if this IS the base branch
git config rerere.enabled true                      # replays resolutions you already made
git remote set-head origin -a                       # only if origin/HEAD is missing (fresh CI clone)
git symbolic-ref --short refs/remotes/origin/HEAD   # -> origin/<default>
```

`<base>` precedence: user's answer > repo docs (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`) > open PR's `baseRefName` > `origin/HEAD`. None resolve → ask.

Find lint/test commands the same way (`package.json` scripts, `Makefile`, `justfile`) and **require a non-watch variant**: `test` is often `jest --watch` and never returns. Take the `test-ci`-style script, or force `--watchAll=false` / `CI=true`. None found → say so, don't skip silently.

## Cadence

Run the loop unprompted at: **session start**, **after each commit**, **before push/PR**, **on staleness** (upstream touched your files, CI conflicts, user mentions a merged PR).

Between syncs, commit each coherent unit as soon as it works — repo's commit convention, `git log --oneline` if undocumented. One dirty tree holding three unrelated changes = a three-front conflict.

## Loop

```bash
git status --short                         # clean, else: git stash push -u   (-u, or untracked files break the rebase)
git fetch origin <base>
git rev-list --count HEAD..origin/<base>   # 0 -> nothing to do, stop here
git branch -f backup/<branch>              # net: a bad rebase undoes with git reset --hard backup/<branch>
git rebase origin/<base>
git rev-list --count HEAD..origin/<base>   # back to 0? if not, upstream moved — run the loop again
```

Stashed → `git stash pop`, re-check status.

Done when: the second counter reads `0`, `git status` is clean, no `.orig`/`.rej` left.

Conflict resolved or >10 commits absorbed → run lint + the non-watch tests. A rebase lands code that never compiled against the new base.

## Conflicts

Resolve now, hunk by hunk, while the work is still in your head.

- Read both sides, understand why the base changed. Never blanket `--ours`/`--theirs`.
- `git add <file>` → `GIT_EDITOR=true git rebase --continue`. Without `GIT_EDITOR=true` the editor opens and hangs a non-interactive shell, leaving the rebase half-done.
- **Never `--skip`** — it drops one of your commits.
- A branch far behind conflicts on many commits in a row. That is the normal cost: persevere commit by commit, `rerere` replays the repeats. Never squash your own commits just to shorten a rebase.
- `git rebase --abort` restores the pre-rebase state exactly. Use it and ask only on substance: the conflict touches logic you can't attribute, or resolving means rewriting someone else's change.
- Then read `git diff origin/<base>...HEAD`: only your work. Upstream code in there = a conflict resolved backwards.

## Push

```bash
git push --force-with-lease --force-if-includes origin HEAD   # branch already pushed, then rebased
```

Both flags: a background fetch (VS Code auto-fetch, an IDE, another agent) refreshes the remote-tracking ref and makes a stale lease look current — `--force-if-includes` also demands you actually integrated what's on the remote. Rejected → stop and report, never plain `--force`. Never force-push a shared branch (`main`, `develop`, release). Never rebase a branch someone else commits to without asking. Push and open PRs only when asked; the loop itself is local.

## Report

Close every sync with one line: commits absorbed, files that conflicted, backup ref — or `already up to date` when the counter was 0. The user may not read git; the report is how they know what moved.

## Never

- `git merge <base>` into the feature branch — unless `git log --merges --oneline -5 origin/<base>` shows the repo really merges. Rebase flattens merge commits inside your branch; that is intended, don't reach for `--rebase-merges`.
- `git checkout .`, `git reset --hard`, `git clean -fd` on a dirty tree. Stash instead.
- `git add -A` sweeping unrelated files. Stage explicitly.
- Leave a rebase half-finished across turns. Continue or `--abort`.
