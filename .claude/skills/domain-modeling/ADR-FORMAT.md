# ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc. They are written in English, like the code.

## Template

```md
# {Short title of the decision}

- Status: proposed
- Date: {YYYY-MM-DD}
- Epic: #{epic issue number, added once the epic exists}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording _that_ a decision was made and _why_, not in filling out sections.

## Status

- `proposed`: written during the grilling, shipped in the feature's first PR
- `accepted`: the first PR is merged
- `deprecated`: the feature or the constraint is gone
- `superseded by ADR-NNNN`: a later decision replaced it

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Considered Options**: only when the rejected alternatives are worth remembering
- **Consequences**: only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one. Two feature branches can pick the same number: whoever merges second renumbers.

## Public repository

The repository is public. An ADR never names a client, never describes an unfixed vulnerability, and never contains a secret or an internal URL.

## What qualifies

- **Architectural shape.** "Translation runs in a background job, not in the request."
- **Integration patterns between modules.** "The editor talks to the server only through the REST API, never through shared state."
- **Technology choices that carry lock-in.** Database, queue, AI provider, storage. Not every library: just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "A mailing belongs to exactly one workspace." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "Exports must work with Outlook 2016 because of the clients' recipients."
- **Rejected alternatives when the rejection is non-obvious.** If you considered WebSockets and picked polling for subtle reasons, record it; otherwise someone will suggest WebSockets again in six months.
