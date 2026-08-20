---
name: git-sync
description: Keep the current branch rebased on its base branch and the worktree clean. Use at session start, after each commit, before opening or updating a PR, when a rebase conflicts, or when the user says "rebase", "sync", "am I up to date", "merge main".
---

Rebase is maintenance, not a finishing move. Keep a **short leash**: never more than a few base commits behind, never more than one unit of work in the tree.

## Resolve `<base>` once per session

```bash
git rev-parse --abbrev-ref HEAD                                # abort if this IS the base branch
git symbolic-ref --short refs/remotes/origin/HEAD              # -> origin/<default>
```

Precedence: user's answer > repo docs (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`) > open PR's `baseRefName` > `origin/HEAD`. None resolve → ask.

Find lint/test commands the same way (`package.json` scripts, `Makefile`, `justfile`). None found → say so, don't skip silently.

## Cadence

Run the loop unprompted at: **session start**, **after each commit**, **before push/PR**, **on staleness** (upstream touched your files, CI conflicts, user mentions a merged PR).

Between syncs, commit each coherent unit as soon as it works — repo's commit convention, `git log --oneline` if undocumented. One dirty tree holding three unrelated changes = a three-front conflict.

## Loop

```bash
git status --short                        # clean, else commit or stash
git fetch origin <base>
git rev-list --count HEAD..origin/<base>  # 0 -> done
git rebase origin/<base>
```

Stashed → `git stash pop`, re-check status.

Done when: counter is `0`, `git status` clean, no `.orig`/`.rej` left.

Conflict resolved or >10 commits absorbed → run lint + tests. A rebase lands code that never compiled against the new base.

## Conflicts

Resolve now, hunk by hunk, while the work is still in your head.

- Read both sides, understand why the base changed. Never blanket `--ours`/`--theirs`.
- `git add <file>` → `git rebase --continue`.
- **Never `--skip`** — it drops one of your commits.
- `git rebase --abort` restores the pre-rebase state exactly. Use it and ask when: the conflict touches logic you can't attribute, the same file conflicts on 3+ consecutive commits (drifted too far — squash your commits, then rebase again), or resolving means rewriting someone else's change.
- Then read `git diff origin/<base>...HEAD`: only your work. Upstream code in there = a conflict resolved backwards.

## Push

```bash
git push --force-with-lease origin HEAD   # branch already pushed, then rebased
```

`--force-with-lease` only — plain `--force` overwrites a teammate's push. Never force-push a shared branch (`main`, `develop`, release). Never rebase a branch someone else commits to without asking. Push and open PRs only when asked; the loop itself is local.

## Never

- `git merge <base>` into the feature branch — unless `git log --merges --oneline -5 origin/<base>` shows the repo really merges.
- `git checkout .`, `git reset --hard`, `git clean -fd` on a dirty tree. Commit or stash.
- `git add -A` sweeping unrelated files. Stage explicitly.
- Leave a rebase half-finished across turns. Continue or `--abort`.
