---
name: to-issues
description: Break an epic (or a plan, or the current conversation) into tracer-bullet tickets published as GitHub sub-issues of the epic, each with its blocking edges. Use right after to-prd, or when the user asks to split a feature into tickets or issues.
---

# To Issues

This is step 3 of the new feature workflow in `AGENTS.md`. Break the epic into **tickets**: tracer-bullet vertical slices, each declaring the tickets that **block** it.

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user passes an epic number or URL, read it with `gh issue view <number> --comments`.

### 2. Explore the codebase (optional)

If you have not already explored the code, do so. Ticket titles and descriptions use the vocabulary of `GLOSSARY.md` and respect the ADRs in `docs/adr/`.

Check for overlapping work (`AGENTS.md`, section "Parallel Work"): a ticket that an open PR already covers is either dropped or blocked by that PR, and the user decides which.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Ticket **01** is always the **foundation ticket**: it ships the ADR, the `GLOSSARY.md` changes, and the tests at the agreed seams, written in full but skipped (see the "tdd" skill, section "The first PR"). It is the feature's first PR. Every other ticket is blocked by it, directly or not.

Break the rest of the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window, and in a PR that respects `docs/AI_POLICIES.md` (one concern, reviewable, files under 300 lines)
- Each slice says which skipped tests from ticket 01 it turns on
- Any prefactoring comes first, right after ticket 01

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must complete before it can start.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a field, retype a shared helper) whose **blast radius** fans across the whole codebase, so no vertical slice can land green. Sequence it as **expand–contract**: first expand (add the new form beside the old so nothing breaks), then migrate the call sites in batches sized by blast radius (per package, per module), each batch its own ticket blocked by the expand, then contract (delete the old form once no caller remains) in a ticket blocked by every batch.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown. Nothing is published before that.

### 5. Publish the tickets as sub-issues of the epic

Publish in dependency order (blockers first), so each ticket's edges can point at real issue numbers:

```bash
gh issue create --title "<title>" --type Task --parent <epic> --body-file <ticket.md>
gh issue edit <ticket> --add-blocked-by <blocker>      # once per blocking edge
```

If the installed `gh` lacks `--parent` or `--add-blocked-by`, upgrade it, or fall back to a `Blocked by: #<n>` line at the top of the body and a task list in the epic.

A ticket is on the **frontier** when all its blockers are closed: those are the ones that can start, possibly in parallel.

Do NOT close or edit the epic's body. The repository is public: the same rules as the epic apply (no client name, no unfixed vulnerability, no secret).

<issue-template>

## Parent

#<epic>

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective, not layer-by-layer implementation.

## Tests

The skipped tests from ticket 01 this ticket turns on, by name.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- #<n>, or "None (can start immediately)".

</issue-template>

Avoid specific file paths or code snippets: they go stale fast. Exception: a snippet from a prototype that encodes a decision more precisely than prose can, trimmed to the decision-rich parts.
