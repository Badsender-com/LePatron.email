# Following what is new in the skills and expertises

The skills and expertises change often. Your assistant can tell you what changed, and when, without guessing: ask it, for instance, "What is new in LePatron this week?" or "What changed in the deliverability expertises since November 1?".

## What the assistant knows of each item

- **Its version and publication date.** Every skill and expertise the assistant reads says its version and the day it was published, in UTC. A version whose publication was never recorded has no date: the assistant does not make one up.
- **Its release note.** Every publication says, in 500 characters at most, what changes for whoever uses the item. The older minor versions published with the generic sentence "Correction mineure sans changement de doctrine." have no release note.
- **Search covers the skills.** The `search` tool finds the skills, as it finds the mailings and the expertises, by the words of their title or description.

## The changes of a period

The `list_changes` tool lists, for a period (the last 7 days by default, 200 changes at most), what was:

| Change    | What happened                                                             |
| --------- | ------------------------------------------------------------------------- |
| created   | a new item is available                                                   |
| updated   | a new version was published, with its release note                        |
| opened    | the item is now open to every company                                     |
| withdrawn | the item is no longer available: taken out of their audience, or archived |

A date without a time is the whole day, in UTC: "from November 16 to 22" includes the 22nd.

A draft is never a change: only what was published counts.

## What each company sees

- **A client company** sees only what is open to it. An item opened to every company appears as **created** on the day it was opened, even if it existed before for the platform company: its earlier versions are never shown to it. A withdrawn item appears by its title alone.
- **The platform company** sees everything, openings and withdrawals included, with the **changelog** of each version: how and why it was written. The changelog is never shown to the other companies.
- **A super admin** also sees the retex each version took into account ([Retex](./retex.md)).

Openings are dated since this tracking started. For older ones, only those made from an assistant, and still in the call log, could be taken back: an item whose opening could not be dated does not appear as created, but its later versions do appear.
