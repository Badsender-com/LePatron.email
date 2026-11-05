# Architecture Decision Records

Each file records one decision that is hard to reverse, surprising without context, and the result of a real trade-off: what was decided, and why.

- Written during the grilling of a new feature (`/grill-with-docs`), shipped in the feature's first PR. See `AGENTS.md`, section "New Feature Workflow".
- Format and criteria: [.claude/skills/domain-modeling/ADR-FORMAT.md](../../.claude/skills/domain-modeling/ADR-FORMAT.md).
- Sequential numbering, `NNNN-slug.md`, in English. A reversed decision gets a new ADR; the old one is marked `superseded by ADR-NNNN`.
- The repository is public: no client name, no unfixed vulnerability, no secret.

| ADR                                                           | Decision                                                                                                                                                            | Status                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| [0001](./0001-grill-first-feature-workflow.md)                | New features start with a grilling, an ADR, an epic and tickets                                                                                                     | proposed                     |
| [0002](./0002-super-admin-persisted-role.md)                  | Super admin is a persisted role; the bootstrap account creates the first one; a super admin works in the modules of a selected group                                | accepted, amendment proposed |
| [0004](./0004-reviewer-writer-tech-admin-roles.md)            | A role is a fixed list of capabilities, shared by the server, the UI and the editor; what it does not list is refused                                               | proposed                     |
| [0005](./0005-gallery-thumbnail-anatomy.md)                   | A gallery thumbnail is an image area plus a label band, and the hover overlay never covers the band                                                                 | proposed                     |
| [0006](./0006-editing-a-gallery-image-adds-a-copy.md)         | Editing a gallery image adds a numbered copy; it never replaces the original                                                                                        | proposed                     |
| [0007](./0007-search-across-accessible-workspaces.md)         | Searching every accessible workspace is a read-only listing with its own route; the database applies the rights on an explicit list of locations                    | proposed                     |
| [0008](./0008-two-factor-authentication-required-by-group.md) | A group requires two-factor authentication of all its members or none; the session opens only once the code is checked; a trusted device skips the code for 30 days | proposed                     |
| [0014](./0014-standard-dimensions-and-company-dimensions.md)  | Only the email type and the email trigger are standard dimensions; every other one is the company's, and an email carries one value of each                         | proposed                     |
| [0015](./0015-a-dimension-is-identified-by-its-name.md)       | A dimension is identified by its name, which is what a template reads, and the name is write-once                                                                   | proposed                     |
