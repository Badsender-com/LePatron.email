# Every company reads what changed in its catalog, from the release notes

- Status: proposed
- Date: 2026-11-23
- Epic: #1661, #1662
- Amends: ADR 0014 (what is written at publication), ADR 0019 (the audience keeps its history)

The skills and expertises change every day, and whoever uses them through an assistant cannot tell what changed since they last looked: no tool gives a date, a skill's resource gives only its number, and a minor version is published with a generic sentence that says nothing. The platform company wants to tell its consultants and its clients every week what is new, and an assistant should be able to answer it from LePatron alone, without inventing a date or a reason.

**A catalog change is an event, as a company sees it.** An item is created, updated by a new version, opened to every company, or withdrawn from them. An archived item counts as withdrawn. For any company but the platform company, the opening is when the item appears and the withdrawal is when it goes: such a company never learns that an item existed before it was opened. It sees only `created`, `updated` and `withdrawn`: an opening is a creation to it, and so is a reopening after a withdrawal. A tool, `list_changes`, lists the changes of a period in chronological order, the last seven days by default, at most two hundred at a time and saying so when it cuts. Its dates are in UTC, in ISO 8601 with a `Z`. It lists only what was published: a draft is no change, in the drafts mode as anywhere. A withdrawn item is listed with its title alone, neither its content nor the reason.

**Two texts at every publication, for two readers.** The **release note** says what changed for whoever uses the item; every company that reads the item reads it. The **change log** says how and why the version was written; only the platform company reads it. Both are required at every publication, minor or major, from an assistant or from the back office, and the release note is at most 500 characters. The generic sentence a minor version used to get by default goes: a release note that says nothing is no release note. The old ones are answered as no release note, never shown as if someone had written them. Which retex a version addressed is the platform company's business, as the retex are (ADR 0021): a client reads none of it. The code keeps the names `releaseNotes` and `changelog` everywhere: in what a tool takes, in what it answers, and as stored.

**The change log and the retex follow the person.** A super admin reads them through any connection, a client company's included. The catalog stays the connected company's: through a client's connection, a super admin reads the items that client reads, dated as that client sees them.

**A client reads the versions published since the item was opened to it.** A previous version, and the difference between two versions, are read through an assistant within those versions only, so the history of an item tried by the platform company alone stays with it. Anything else is answered as not found. The first version a client sees is dated by the item's opening, in `list_changes`, in what a tool finds and in a resource's version line alike; the versions published after it are dated by their publication.

**A copy dates what it received.** On a copy (ADR 0019), a version's publication date is when it arrived on that instance, by a follow or a publication there, not when production published it.

**The audience keeps its history, from now on.** Which way it went, when, and who set it. There is no past to take back: production held neither an audience nor an MCP call log before this. An item open to every company with no history has been open since its first publication: it served every company before audiences existed.

**Sources and pitch.** A version carries its sources, each a link with its title, author, date and whether it is a reference, read by every company that reads the version. The existing sources are taken from the text of the items, dry first; what cannot be read stays empty. An item carries a pitch, one sentence of at most 280 characters saying what it is for, required to open it to every company.

**One company per connection, still.** A super admin who works for several companies adds the connector once per company, each with its own consent, and ADR 0012 is unchanged. A switch between companies was rejected: the connection is shared by every conversation of an application, so one conversation switching would silently move the others, a weekly task reading the platform company's catalog included. A company argument on every tool was rejected for now, as ADR 0012 did: it changes every tool, and the resources and prompts take no argument. Both may be reopened if working for several companies in one day becomes common.

## Considered Options

- **Dates in the resources only, and the assistant compares**: rejected. It needs the previous reading, and a client cannot tell an opening from a creation.
- **A release note required for major versions only**: rejected. Most changes are minor, and they are the ones nobody can explain afterwards.
- **A difference summarised by the server**: rejected. The assistant summarises a difference well, and the server runs no model for it.
