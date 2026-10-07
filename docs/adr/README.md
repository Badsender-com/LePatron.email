# Architecture Decision Records

Each file records one decision that is hard to reverse, surprising without context, and the result of a real trade-off: what was decided, and why.

- Written during the grilling of a new feature (`/grill-with-docs`), shipped in the feature's first PR. See `AGENTS.md`, section "New Feature Workflow".
- Format and criteria: [.claude/skills/domain-modeling/ADR-FORMAT.md](../../.claude/skills/domain-modeling/ADR-FORMAT.md).
- Sequential numbering, `NNNN-slug.md`, in English. A reversed decision gets a new ADR; the old one is marked `superseded by ADR-NNNN`.
- The repository is public: no client name, no unfixed vulnerability, no secret.

| ADR                                                       | Decision                                                                                                                       | Status                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| [0001](./0001-grill-first-feature-workflow.md)            | New features start with a grilling, an ADR, an epic and tickets                                                                | proposed                                 |
| [0003](./0003-quality-control-v2.md)                      | The quality control judges only the client's edits, in the editor, and blocks nothing but tracking                             | proposed; superseded by 0004 on blocking |
| [0004](./0004-quality-settings-per-group-and-template.md) | Each group sets the state and thresholds of its checks, a template overrides them one by one, and a check can block the export | proposed                                 |
