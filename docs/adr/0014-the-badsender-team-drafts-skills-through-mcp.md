# The platform company drafts skills and expertises through MCP, and only drafts

- Status: proposed
- Date: 2026-10-30
- Epic: #1290
- Extends: ADR 0012 (read-only first), ADR 0013

The skills and expertises improve with use: the feedback and retex of ADR 0012 tell the platform company what to change, and an assistant is a good place to rewrite a procedure or an expertise from them. MCP gets its first writes for that, ahead of any write on mailings, which still waits for #1103.

**Who.** The writing tools exist only for a token carrying the `skills:write` scope, which the consent screen proposes only to a user who may manage the platform (`platform.manage`, ADR 0004), the right the skills back office asks for. The capability is checked again on every call, like everything in ADR 0012: a token never outlives the right it was given for. A dedicated capability is added if people who are not super admins come to author.

**What.** Drafts only. An assistant proposes a change to a skill or an expertise, which updates the open draft or starts a minor one (a major one on request) from the active version; the open draft is the latest one newer than the active version, a major is never written into an open minor, and an archived one takes no draft, or it creates a new expertise or task skill as a draft, whose audience is the platform company. It never activates, archives or deletes a version, and never changes an audience: publishing stays a human act in the back office, so no assistant mistake reaches a client, and a draft is never served to assistants. The writes go through the back office's own services, and the drafts are numbered and seeded as the back office does it. Two rules are the assistant's alone. It never opens a second draft: the versioning service finds the open draft or starts one (`openOrStartDraft`), starting it on the condition that the versions did not change since they were read, so two changes an assistant sends at once go to one draft. And it never writes over a change it did not read: its change is written into the draft on the condition that the draft was not written since it was read (its update date, `writeDraftIfUnchanged`); otherwise the proposal is refused, saying the draft changed and to read it again before sending the proposal again. The condition holds both ways: the back office sends the update date of the draft its screen read with a save and with a publication, and a draft written since, by an assistant or another person, is refused with a 409; the screen keeps what the person typed and offers to reload the draft, so no one saves over a proposal or publishes it unread. A request without that date, from an older client, writes as before. The back office keeps starting the drafts a person asks for, a second one included. A creation writes the item with its whole first version at once: a refused creation leaves nothing behind.

**Trace.** Every write records the user and requires a changelog written by the assistant. A proposal adds its changelog after the one of the draft it writes into, so what a person or an earlier proposal wrote of that draft stays; the default changelog of a new minor version counts as empty, so a draft the proposal starts holds its changelog alone. Since the write is conditioned on the draft read, two proposals at once never lose a line of it: the second is refused, to be sent again. A draft's changelog holds 10,000 characters at most; a proposal that would make it longer is refused, for a person to shorten it in the back office. Its answer gives the difference with the active version, for the person to read before publishing. The call log of ADR 0012 records the connected application.

## Considered Options

- **Letting an assistant publish**: rejected. The audience and the activation are the two gates between a draft and a client; both stay in human hands.
- **Writing tools listed to everyone and refused at the call**: rejected, they would clutter every client's assistant with tools it can never use; they are registered only for a token with the scope, and refused if the right is gone.
- **The platform company as the criterion**: rejected, membership does not say who may manage the platform; the capability does, as in the back office.

## Consequences

- MCP is no longer read-only: besides the feedback of ADR 0012, it writes the drafts of the platform company's own skills and expertises, and ADR 0012's title says so.
- The authorization server of #1306 offers the `skills:write` scope, at consent, to holders of `platform.manage` only.
