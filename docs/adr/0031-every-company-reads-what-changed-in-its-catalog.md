# Every company reads what changed in its catalog, from the release notes

- Status: proposed
- Date: 2026-11-23
- Epic: #1661, #1662
- Amends: ADR 0014 (what is written at publication), ADR 0019 (the audience keeps its history)

The skills and expertises change every day, and whoever uses them through an assistant cannot tell what changed since they last looked: no tool gives a date, a skill's resource gives only its number, and a minor version is published with a generic sentence that says nothing. The platform company wants to tell its consultants and its clients every week what is new, and an assistant should be able to answer it from LePatron alone, without inventing a date or a reason.

**A catalog change is an event, as a company sees it.** An item is created, updated by a new version, opened to every company, or withdrawn from them. An archived item counts as withdrawn, and one published again is opened again. For any company but the platform company, the opening is when the item appears and the withdrawal is when it goes: such a company never learns that an item existed before it was opened. It sees only `created`, `updated` and `withdrawn`: an opening is a creation to it, and so is a reopening after a withdrawal. An opening brings the release note of the version opened, which was written for every reader.

**A company is never told of an item it never saw.** An item is withdrawn from a company only if a version of it was published before the end of the span it was open to that company. An item opened before its first publication and closed again, or a draft open to every company and archived, never reaches it, not even by its title. A company other than the platform company is told of a skill only if `find_skills` serves it: a task skill, or a feature skill marked for assistants.

**`list_changes` lists the changes of a period.** In chronological order, the last seven days by default. When more than two hundred changes are found, it keeps the two hundred most recent, still in chronological order, and says so. Its dates are in UTC, in ISO 8601 with a `Z`; it reads only ISO 8601 dates, a date-time without a zone in UTC, and refuses any other form. It lists only what was published: a draft is no change, in the drafts mode as anywhere. A withdrawn item is listed with its title alone, neither its content nor the reason.

**Two texts at every publication, for two readers.** The **release note** says what changed for whoever uses the item; every company that reads the item reads it. The **change log** says how and why the version was written; only the platform company reads it. Both are required at every publication, minor or major, from an assistant or from the back office, and the release note is at most 500 characters. The generic sentence a minor version used to get by default goes: a release note that says nothing is no release note. The old ones are answered as no release note, never shown as if someone had written them. Which retex a version addressed is the platform company's business, as the retex are (ADR 0021): a client reads none of it. The code keeps the names `releaseNotes` and `changelog` everywhere: in what a tool takes, in what it answers, and as stored.

**The change log and the retex follow the person.** A super admin reads them through any connection, a client company's included. The catalog stays the connected company's: through a client's connection, a super admin reads the items that client reads, dated as that client sees them.

**A client reads the versions published since the item was opened to it.** A previous version, and the difference between two versions, are read through an assistant within those versions only, so the history of an item tried by the platform company alone stays with it. Anything else is answered as not found. The first version a client sees is dated by the item's opening, in `list_changes`, in what a tool finds and in a resource's version line alike; the versions published after it are dated by their publication.

**A copy dates what it received.** On a copy (ADR 0019), a version's publication date is when it arrived on that instance, by a follow or a publication there, not when production published it.

**The audience keeps its history, from now on.** Which way it went, when, and who set it. An archiving and a publication that makes an archived item active again are events of the same history: an item archived and then published again comes back for every company that reads it. `archivedAt` is the date of the archiving, set only as the item is archived and cleared once it is published again. An entry that leaves the item as it was is no change. An item never published is never opened, from the back office as from an assistant. Every write of an audience keeps it, the follow of a copy included: there, the change is dated with the follow and set by no one. There is no past to take back: production held neither an audience nor an MCP call log before this. An item open to every company with no history has been open since its first publication: it served every company before audiences existed.

**Sources and pitch.** A version carries its sources, each a link with its title, author, date and whether it is a reference, read by every company that reads the version. The existing sources are taken from the text of the items, dry first; what cannot be read stays empty. An item carries a pitch, one sentence of at most 280 characters saying what it is for, required to open it to every company.

**One company per connection, still.** A super admin who works for several companies adds the connector once per company, each with its own consent, and ADR 0012 is unchanged. A switch between companies was rejected: the connection is shared by every conversation of an application, so one conversation switching would silently move the others, a weekly task reading the platform company's catalog included. A company argument on every tool was rejected for now, as ADR 0012 did: it changes every tool, and the resources and prompts take no argument. Both may be reopened if working for several companies in one day becomes common.

## Considered Options

- **Dates in the resources only, and the assistant compares**: rejected. It needs the previous reading, and a client cannot tell an opening from a creation.
- **A release note required for major versions only**: rejected. Most changes are minor, and they are the ones nobody can explain afterwards.
- **A difference summarised by the server**: rejected. The assistant summarises a difference well, and the server runs no model for it.
