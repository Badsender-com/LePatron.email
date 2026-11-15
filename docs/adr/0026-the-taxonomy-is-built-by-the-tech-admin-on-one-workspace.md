# The taxonomy is built by the tech admin, on one workspace, and a value's identifier can change after its impact is shown

- Status: proposed
- Date: 2026-11-15
- Epic: #1547

The taxonomy screen grew one feature at a time: dimensions, values, availability, design tokens, precedence, roles, scope, defaults (ADR-0014, 0015, 0023, 0024). Each one added a column, a dialog or a number to type, and the person setting up a company, usually a consultant, has no view of the whole: which value is offered under which parent, what a template will actually propose, what is still missing. The screen is rebuilt as one workspace, and four decisions come with it.

## Decisions

- **Building the taxonomy is a capability of its own, `taxonomy.manage`**, held by the tech admin and the super admin. The company admin reads the same screen and changes nothing, the email type included. Today the company admin edits all of it: this is a right withdrawn on purpose. The taxonomy is the contract every template of the company rests on; a value renamed or deactivated changes what emails render. The bulk adoption of a template's emails (ADR-0024), until now the super admin's, opens to the tech admin with the same capability.
- **A value's identifier can change once emails carry it, after its impact is shown.** The server answers, for the new identifier, how many emails carry the value and which templates compare the old one, and how often. The change is applied only when it is confirmed. Nothing is rewritten in bulk: an email keeps the value, and its content takes the new identifier the next time it is opened in the editor. A template comparing the old identifier no longer recognises the value, and is fixed by hand. A dimension's name stays write-once (ADR-0015).
- **The template contract records the literals a template compares a root property against** (`market eq 'be'`), a new version of its reader. The impact of an identifier change, and the point "a template compares `fr`, which is not offered under Canada", read them. Contracts stored by the previous reader are read again on their next need, as for every version.
- **The crossings of a child dimension are saved together.** Its availability and its defaults under each parent value are edited as one matrix, kept as a draft, and saved by one request that replaces them all, or refuses them all. Everywhere else on the screen, a change is saved as soon as it is made. A value offered "everywhere, future values included" keeps an empty availability, as today.

The rest of the workspace follows from these: order and precedence are set by drag and drop instead of typed numbers, a dimension is created where it goes in the tree, and the points to check (a value of a dimension with a role and no normalised code, a parent value under which no child value is offered, a dimension or a token no template reads) are shown and never block.

## Considered Options

**Leave it to the company admin (`group.manage`).** The current state. Rejected: the company admin manages people and workspaces; the taxonomy is closer to templates, and a mistake there breaks rendering.

**Fold it into `group.manage-tech`.** The tech admin holds both anyway. Rejected: the technical settings are integrations and tracking, and a separate capability lets a future role build the taxonomy without touching the integrations, or the reverse.

**An identifier as write-once as a dimension's name.** Consistent with ADR-0015, and a typo or a renamed market would be stuck for good. Unlike a dimension's name, the places an identifier is compared against are known from the contracts, so the impact can be shown before the change, which is what makes it safe enough.

**Rewriting every email's content when an identifier changes.** Rejected: it needs the editor to run on the server, already out of scope in ADR-0024, and it would change saved emails nobody opened.

**Saving each cell of the matrix at once.** Rejected: availability and defaults have to agree (a default under a parent value where the value is not offered is refused), so a change made cell by cell passes through states the server refuses; and filling a matrix of a dozen columns would be as many requests.

## Consequences

The routes of the taxonomy and of the dimensions ask for `taxonomy.manage`, and the reads stay open to every member of the company. The change goes through the rights review (`docs/agents/rights-review.md`).

The typing of design tokens (a colour, an image, a text) is left to its own epic; the screen keeps its place for it.
