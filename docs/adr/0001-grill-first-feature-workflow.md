# New features start with a grilling, an ADR, an epic and tickets

- Status: proposed
- Date: 2026-10-02

Features used to start from a loose issue and land as large PRs whose design choices were only discovered in review. A new feature now goes through a fixed sequence before any production code: a grilling of the design (`/grill-with-docs`), which records its decisions in an ADR and its vocabulary in `GLOSSARY.md`; a PRD published as an epic issue (`/to-prd`); tracer-bullet tickets as sub-issues of the epic (`/to-issues`); and a first PR holding only the ADR and the acceptance tests, skipped until the ticket that turns them on. We accept a slower start in exchange for reviewing the design and the expected behavior before the code, and for small PRs that each map to one ticket.

## Considered Options

- **Tests and implementation in the same PR, ticket by ticket**: the usual TDD flow, but the expected behavior of the whole feature is then never reviewed on its own.
- **Failing tests in the first PR**: rejected, CI must stay green (`docs/AI_POLICIES.md`), and Jest 27 has no `test.failing`.

## Consequences

- Bug fixes and small changes skip the workflow; the boundary is in `AGENTS.md`.
- Skipped tests must name the ticket that turns them on, or they rot silently.
