---
name: tdd
description: Test-driven development with Jest. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", writes the first PR of a feature (ADR + tests), or implements a ticket of an epic.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

Read `GLOSSARY.md` (if it exists) so test names match the product's vocabulary, and respect the ADRs in `docs/adr/` in the area you're touching.

## In this repository

- Jest 27. Tests live in `tests/`, mirroring the source: `packages/server/comment/comment.service.js` → `tests/server/comment/comment.service.test.js`. See `tests/README.md`.
- Run one file with `yarn jest <path>`, the whole suite with `yarn test-ci`. Never `yarn test`: it is `jest --watch` and never exits.
- Prior art: route tests over a real express router with mocked services (`tests/server/ai-skill/routes/`), guard assertions with `tests/helpers/express-router.js`, Vue components with `@vue/test-utils` (`tests/ui/components/`).

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "a regular user cannot list the mailings of another group" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Here, typically: an express route (status, payload, guard), a service function, a pure helper, a Vue component's props, events and rendered output. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** In the new feature workflow, the seams were agreed during the grilling and written in the epic. Otherwise, before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam.

## The first PR (ADR + tests)

The first PR of a feature (ticket 01 of the epic) ships the ADR, the `GLOSSARY.md` changes, and the tests at the agreed seams, before any production code. CI must stay green (`docs/AI_POLICIES.md`), so these tests are written in full but **skipped**, each block naming the ticket that turns it on:

```javascript
// Turned on by #1234 (search across all workspaces)
describe.skip('global mailing search', () => {
  let searchMailings;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist
    // until #1234 ships it, and a top-level require would break the suite.
    ({
      searchMailings,
    } = require('../../../packages/server/mailing/mailing-search.service'));
  });

  it('never returns a mailing from a workspace the user has no right on', async () => {
    // ...
  });
});
```

Write them as the specification of the epic's acceptance criteria: real inputs, real expected values, no placeholder assertions. Reviewers of the first PR review the behavior the feature commits to.

This is the one exception to the vertical-slice rule below: these tests are the epic's acceptance specification, not the unit tests of the loop. Each ticket then removes the `.skip` of its blocks (red), implements until they pass (green), and adds the smaller tests its own loop needs. A `describe.skip` with no ticket reference is not allowed; once the epic is closed, none of its skips should remain.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private functions, or verifies through a side channel (reading the Mongoose model instead of calling the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the epic.
- **Horizontal slicing** inside a ticket: writing all the unit tests first, then all the implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Watch the test fail first, for the right reason, then write only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (`/review`), not the red → green cycle.
- **Before pushing**: `yarn test-ci` and `yarn code:lint` pass.
