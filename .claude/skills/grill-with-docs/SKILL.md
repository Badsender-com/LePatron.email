---
name: grill-with-docs
description: Grill a new feature before any code is written, recording the decisions as an ADR and the vocabulary in GLOSSARY.md as we go. Use when the user asks to build a new feature, starts designing one, or says "grill", "let's design", "nouvelle feature". Not for bug fixes or small changes.
---

This is step 1 of the new feature workflow described in `AGENTS.md` (section "New Feature Workflow"). No production code is written during this step.

1. Read `GLOSSARY.md` (if it exists) and the ADRs in `docs/adr/` that touch the area of the feature. Then look for overlapping work as described in `AGENTS.md`, section "Parallel Work": an open PR, an epic or a recently merged change on the same subject is the first thing to put to the user.
2. Call the Skill tool twice, for "grilling" and "domain-modeling", and run the interview with both disciplines at once.
3. During the interview, agree on the **seams** the feature will be tested at (the public interfaces: an API route, a service function, a Vue component's props and events). Prefer existing seams and the highest one possible; the fewest seams is best. They become the tests of the first PR.
4. Before the shared understanding, settle the **MCP exposure**: should an assistant connected through the MCP server read or do what this feature adds? Put it to the user as a decision with your recommendation, among:
   - **now**: in the feature's scope, as an expertise resource, a skill prompt, a read tool or a writing tool;
   - **later**: worth it, but in its own epic;
   - **never**: say why (a setting only an admin changes, a screen with nothing to read, a risk for the client's data).
     Exposing it follows the MCP ADRs (0012, 0014, 0017): access asked again on every call through the existing capabilities, writing behind its own scope, the grammar the tool contract tests check. The decision and its reason go into the ADR, whatever it is.
5. When the user confirms the shared understanding, make sure the feature has its ADR in `docs/adr/`, with `Status: proposed` and the main design decisions of the feature. A new feature always ends with at least one ADR; the domain-modeling criteria decide which decisions deserve to be in it.
6. Hand over to the next step: tell the user the next one is the epic, and call the Skill tool with "to-prd".

If the effort turns out too big to settle in one session (several epics, a greenfield module), say so and propose to split it into several features, each grilled on its own.
