# The Badsender team drafts skills and expertises through MCP, and only drafts

- Status: proposed
- Date: 2026-10-30
- Epic: #1290
- Extends: ADR 0012 (read-only first), ADR 0013

The skills and expertises improve with use: the feedback and retex of ADR 0012 tell the Badsender team what to change, and an assistant is a good place to rewrite a procedure or an expertise from them. MCP gets its first writes for that, ahead of any write on mailings, which still waits for #1103.

**Who.** The writing tools exist only for a token carrying the `skills:write` scope, which the consent screen proposes only to a user who may manage the platform (`platform.manage`, ADR 0004), the right the skills back office asks for. The capability is checked again on every call, like everything in ADR 0012: a token never outlives the right it was given for. A dedicated capability is added if people who are not super admins come to author.

**What.** Drafts only. An assistant proposes a change to a skill or an expertise, which updates the open draft or starts a minor one (a major one on request) from the active version, or it creates a new expertise or task skill as a draft, whose audience is the platform group. It never activates, archives or deletes a version, and never changes an audience: publishing stays a human act in the back office, so no assistant mistake reaches a client, and a draft is never served to assistants. The writes go through the back office's own services, so the versioning rules are the same.

**Trace.** Every write records the user and requires a changelog written by the assistant; its answer gives the difference with the active version, for the person to read before publishing. The call log of ADR 0012 records the connected application.

## Considered Options

- **Letting an assistant publish**: rejected. The audience and the activation are the two gates between a draft and a client; both stay in human hands.
- **Writing tools listed to everyone and refused at the call**: rejected, they would clutter every client's assistant with tools it can never use; they are registered only for a token with the scope, and refused if the right is gone.
- **The platform group as the criterion**: rejected, membership does not say who may manage the platform; the capability does, as in the back office.

## Consequences

- MCP is no longer read-only; ADR 0012's "read-only first" now reads "read-only for everything but the platform's own skills and expertises".
- The authorization server of #1306 offers the `skills:write` scope, at consent, to holders of `platform.manage` only.
