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

`<base>` precedence: user's answer > repo docs (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`) > open PR's `baseRefName` > `origin/HEAD`. None resolve → ask. Never assume the default branch: on a stacked PR the base is the parent feature branch, and rebasing on the default instead drags the whole parent PR into your diff.

Find lint/test commands the same way (`package.json` scripts, `Makefile`, `justfile`) and **require a non-watch variant**: `test` is often `jest --watch` and never returns. Take the `test-ci`-style script, or force `--watchAll=false` / `CI=true`. None found → say so, don't skip silently.

## Cadence

Sync at **session start**, **after each commit**, **before push/PR**, and **on staleness** (upstream touched your files, CI conflicts, user mentions a merged PR). This is intent, not a guarantee — nothing forces a skill to fire. If session-start syncing must be non-negotiable, say so: it takes a `SessionStart` hook in `.claude/settings.json`, run by the harness, not by this skill.

Between syncs, commit each coherent unit as soon as it works — repo's commit convention, `git log --oneline` if undocumented. One dirty tree holding three unrelated changes = a three-front conflict.

## Loop

```bash
git status --short                         # clean, else: git stash push -u   (-u, or untracked files break the rebase)
git fetch origin <base>
git rev-list --count HEAD..origin/<base>   # 0 -> nothing to do, stop here

branch=$(git rev-parse --abbrev-ref HEAD)
backup="backup/${branch//\//-}-$(date +%s)"   # flatten slashes: backup/feat/x collides with a future backup/feat ref
git branch "$backup"                          # a bad rebase undoes with git reset --hard "$backup"

git rebase origin/<base>
git rev-list --count HEAD..origin/<base>   # back to 0? if not, upstream moved — run the loop again
```

Stashed → `git stash pop`, re-check status.

The backup is **local** until pushed — useless from another machine or a fresh clone. See Push.

## Conflicts

Resolve now, hunk by hunk, while the work is still in your head. Don't stop at the first conflict; record each decision for the report.

- Read both sides, understand why the base changed. Never blanket `--ours`/`--theirs`.
- `git add <file>` → `GIT_EDITOR=true git rebase --continue`. Without `GIT_EDITOR=true` the editor opens and hangs a non-interactive shell, leaving the rebase half-done.
- **Never `--skip`** — it drops one of your commits.
- A branch far behind conflicts on many commits in a row. That is the normal cost: persevere commit by commit, `rerere` replays the repeats. Never squash your own commits just to shorten a rebase.
- `git rebase --abort` restores the pre-rebase state exactly. Use it and ask only on substance: the conflict touches logic you can't attribute, or resolving means rewriting someone else's change.

## Verify

A rebase applies cleanly and still leaves a branch that doesn't load. The dangerous breakage is the one git never flagged: upstream deleted a module you still import, or renamed a parameter your call site still passes — no conflict, and a test asserting the old name passes because your code and your test are wrong together.

```bash
git diff --diff-filter=DR --name-only "$backup"...origin/<base>   # what the base deleted or renamed while you were behind
```

Grep the branch for every name that comes back — symbols too, not just paths. A surviving reference is a silent regression; fix it now. (Diff from `$backup`, not `HEAD@{1}`: a rebase writes several reflog entries, so `HEAD@{1}` is not reliably the pre-rebase tip.)

Then check only your own diff — a repo-wide lint blows up on pre-existing errors in vendored code and the rule gets dropped forever:

```bash
<non-watch test script>
npx eslint $(git diff --name-only origin/<base>...HEAD | grep -E '\.(js|vue)$')
npx prettier --check $(git diff --name-only origin/<base>...HEAD)
```

Some repo files aren't formatted to begin with; compare against `$backup`'s state before claiming a formatting regression you didn't cause.

**Anything fails → don't push. Report and stop.** Never a red branch on the remote.

Also read `git diff origin/<base>...HEAD`: only your work. Upstream code in there = a conflict resolved backwards.

## Push

Push the backup **first** — the force-push is the one irreversible step, and what it can destroy is the _remote_ state a reviewer works from.

```bash
git push origin "$backup"                                      # recoverable pre-rebase state, for the reviewer
git push --force-with-lease --force-if-includes origin HEAD     # branch already pushed, then rebased
```

Only before an outgoing operation (force-push, opening a PR) — not on every local sync. Delete it when the PR merges: `git push origin --delete "$backup"`, and prune the local ones. Backups nobody dares delete are worse than none.

Both push flags: a background fetch (VS Code auto-fetch, an IDE, another agent) refreshes the remote-tracking ref and makes a stale lease look current — `--force-if-includes` also demands you actually integrated what's on the remote. Rejected → stop and report, never plain `--force`. Never force-push a shared branch (`main`, `develop`, release). Never rebase a branch someone else commits to without asking. Push and open PRs only when asked; the loop itself is local.

## Report

Close every sync with: commits absorbed, commits replayed, backup ref (and whether it's pushed), verify results. Or `already up to date` when the counter was 0.

Then one line **per conflict** — which side won, and why:

> `BsAiInvocationsTab.vue` — dropped the client-side toggle for the server filter added upstream (the base had reimplemented the same feature server-side).

You resolved those conflicts alone; this list is the only thing standing between a plausible-but-wrong resolution and a merged regression.

## Never

- `git merge <base>` into the feature branch — unless `git log --merges --oneline -5 origin/<base>` shows the repo really merges. Rebase flattens merge commits inside your branch; that is intended, don't reach for `--rebase-merges`.
- `git checkout .`, `git reset --hard`, `git clean -fd` on a dirty tree. Stash instead.
- `git add -A` sweeping unrelated files. Stage explicitly.
- Leave a rebase half-finished across turns. Continue or `--abort`.
