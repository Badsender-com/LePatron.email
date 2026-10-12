---
name: to-prd
description: Turn the grilled feature into a PRD and publish it as an epic GitHub issue. No interview, just synthesis of what was already discussed. Use right after grill-with-docs, or when the user asks for a PRD, a spec or an epic.
---

This is step 2 of the new feature workflow in `AGENTS.md`. It takes the current conversation, the ADR written during the grilling, and the codebase, and produces a PRD published as the feature's **epic**. Do NOT interview the user again; synthesize what you already know. If the feature was never grilled, say so and call the Skill tool with "grill-with-docs" instead.

## Process

1. Explore the repo to understand the current state of the code, if you haven't already. Use the vocabulary of `GLOSSARY.md` throughout, and respect the ADRs in `docs/adr/` in the area you're touching.

2. Restate the seams agreed during the grilling (where the feature will be tested). If none were agreed, sketch them: prefer existing seams, the highest one possible, the fewest across the codebase (ideally one). Check with the user that these seams match their expectations.

3. Write the PRD with the template below, in English like the rest of the tracker. Show it to the user and wait for their go before publishing: the repository is public, and an issue cannot be unpublished.

4. Publish it:

   ```bash
   gh issue create --title "<feature name>" --label "⛰ Epic" --type Feature --body-file <prd.md>
   ```

   Then write the epic number into the ADR's `Epic:` line.

5. Tell the user the next step is the tickets, and call the Skill tool with "to-issues".

## Public repository

Never put a client name, an unfixed vulnerability, a secret, an internal URL or a customer's data in the epic. Describe the need generically ("a client sending to Outlook 2016"), and keep security details for a private channel.

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As a <role>, I want <feature>, so that <benefit>

<user-story-example>
1. As a group admin, I want to restrict a template to some workspaces, so that each team only sees the templates it is allowed to use
</user-story-example>

Use the product's real roles (super admin, group admin, regular user…). This list should be extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions (link the ADR: `docs/adr/NNNN-slug.md`)
- Schema changes and data migrations
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, schema, payload shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts.

## Testing Decisions

- The seams the feature is tested at, and why those
- What makes a good test here (only external behavior, not implementation details)
- Prior art for the tests (similar tests under `tests/`)

## Out of Scope

What this epic deliberately does not do.

## Further Notes

Anything else: rollout, feature flag, i18n, white-label impact, open questions.

</prd-template>
