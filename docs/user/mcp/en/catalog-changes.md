# Following what is new in the skills and expertises

The skills and expertises change often. Your assistant can tell you what changed, and when, without guessing: ask it, for instance, "What is new in LePatron this week?" or "What changed in the deliverability expertises since November 1?".

## What the assistant knows of each item

- **Its version and publication date.** Every skill and expertise the assistant reads says its version and the day it was published, in UTC. For a client company, the first version it sees of an item is dated by the day the item was opened to it; the versions published after it keep their publication date. A version whose publication was never recorded has no date: the assistant does not make one up.
- **Its release note.** Every publication says, in 500 characters at most, what changes for whoever uses the item. The older minor versions published with the generic sentence "Correction mineure sans changement de doctrine." have no release note.
- **Search covers the skills.** The `search` tool finds the skills, as it finds the mailings and the expertises, by the words of their id, title or description, and `fetch` reads a skill found with its version and date. It finds only the skills the assistant may use: neither an archived skill, nor a feature skill not offered to assistants, nor, outside the platform company's drafts mode, a skill never published.

## The changes of a period

The `list_changes` tool lists, for a period (the last 7 days by default), what was:

| Change                          | What happened                                                             |
| ------------------------------- | ------------------------------------------------------------------------- |
| `created`                       | a new item is available                                                   |
| `updated`                       | a new version was published, with its release note                        |
| `opened`, platform company only | the item is now open to every company                                     |
| `withdrawn`                     | the item is no longer available: taken out of their audience, or archived |

The changes are given in chronological order. Past 200, only the 200 most recent are listed, and the assistant is told so: narrow the period to see the others.

A date without a time is the whole day, in UTC: "from November 16 to 22" includes the 22nd.

A draft is never a change: only what was published counts.

For whoever writes a scheduled task: each change gives its date (`at`), in UTC, in ISO 8601 ending with `Z`, its release note (`releaseNotes`) and, for whoever reads the change log, the version's (`changelog`).

## What each company sees

- **A client company** sees only what is open to it, and only three kinds of change: created, updated and withdrawn. An item opened to every company appears as **created** on the day it was opened, even if it existed before for the platform company: its earlier versions are never shown to it. An item withdrawn and then opened again appears as **created** again. A withdrawn item appears by its title alone, and only if the company saw a published version of it.
- **The platform company** sees everything, openings and withdrawals included, with the **change log** of each version: how and why it was written.
- **The change log and the retex follow the person.** The change log is read by the platform company, and by a super admin through any connector. A super admin also sees, through any connector, the retex each version took into account ([Retex](./retex.md)). The other companies see neither.
- **Through a client's connector**, the catalog stays the client's: a super admin sees there the items that client sees, dated as it sees them.

An item open to every company before this tracking started has been open since its first publication: it appears created on that date. The history of openings is recorded from then on.
