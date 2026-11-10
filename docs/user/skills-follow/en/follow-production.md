# Following production's skills and expertises

**Production** is the source of skills and expertises: the platform company writes them there, publishes them there and opens them to clients there. The other instances, staging or development, are **copies**: they receive what production holds, and what is tried on them never goes up to production. A copy follows production **on demand**, from its back office, and **every night** if its instance turns it on.

For **super admins** only, in **Settings › Super admin › Skills & Expertise**, **Production and copies** tab.

To move a few items once through a file, see [Export and import skills](../../skills-export/en/export-import.md) instead.

## 1. On production: create a read token

A copy reads production with a **read token**.

**What a token reads.** Every skill and expertise production holds: the active versions, but also the **drafts**, the items **kept to the platform company** and the **test cases**. It reads nothing else: no emails, no users, no other route of the application.

**Who to give it to.** Only to a copy whose super admins may all read all of that, since the copy will show it in its back office. Otherwise, move a few items through a file instead (link above).

1. On production, **Production and copies** tab, **Read tokens** section, click **Create a token**.
2. Give it a **Name**: the copy it serves, for example "Staging". One token per copy: you can revoke the one you retire without touching the others.
3. The token is shown **once**. Copy it (**Copy** button, or by hand if the browser refuses the copy), hand it to the person who configures the copy, then confirm you saved it to close the window.

The list then shows each token with its creation date and its last use ("never used" until the copy has used it). The token itself is never shown again: if it is lost, revoke it and create another one. Creating and revoking a token are recorded, with who did it, in the security log.

A copy creates no token: **Create a token** does not show on a copy. A copy is never the source of another copy.

## 2. On the copy: configure it

A copy is configured through its **environment variables**, not in a page: the token is neither stored in the database nor shown in the browser. This is done by whoever deploys the instance (see [DEPLOYMENT.md](../../../DEPLOYMENT.md)).

| Variable                | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `SKILLS_SOURCE_URL`     | Production's address, in https, for example `https://production.example` |
| `SKILLS_SOURCE_TOKEN`   | The read token created at step 1                                         |
| `SKILLS_SOURCE_NIGHTLY` | `true` for this instance to follow production every night                |

On production itself, these variables stay unset. Changing production means changing these variables, then restarting the instance.

Once the copy is configured, the **Production and copies** tab opens with a **Follow production** section, showing production's origin (its address, never the token) and whether the nightly follow is on for this instance. Without configuration, this section does not show.

## 3. Follow production

### On demand

Click **Follow now**. The follow first reads production's whole answer, then applies it item by item. When it ends, the skills and expertise lists reload, and the section shows the **last follow** (see [the report](#4-the-report-of-a-follow)).

### Every night

On an instance where `SKILLS_SOURCE_NIGHTLY` is `true`, the copy follows production on its own every night, around 3:00 (UTC), as if the button had been clicked. The last follow then reads "by the nightly follow". When the application runs on several instances, each one starts the nightly follow: a nightly follow is skipped if another one started less than 60 minutes ago, so the copy follows once a night. Without this variable, the copy follows production on demand only, and the tab says so.

### One follow at a time

A follow in progress is recorded in the database as soon as it starts. While it runs, a second follow is refused, whether it comes from the button, the nightly follow or another instance of the same application: the section says a follow is already running. If the process that was following stops on the way, that record expires on its own, and a follow can start again.

### The first follow of a copy that already holds items

A staging that existed before the follow holds items imported by file or written on it, which no follow has marked. Until the copy has succeeded a first follow, its items carry the **Not followed yet** badge.

The first follow takes over **every item whose identifier production also has**: it follows production from then on. If its active version on the copy differs from production's, that version goes as a draft into a "(travail de la copie)" item, like any work of the copy. A staging that drifted from production will hold many of them after its first follow: nothing is lost, and the report lists each one.

**Before that first follow**, you may **Keep on this copy** any item, followed or not: the first follow will not touch it. Then run that first follow by hand, with **Follow now**, and read its report.

## 4. The report of a follow

A follow **Succeeded**, **Partly succeeded** (at least one item failed, the others were written, shown in orange) or **Failed** (nothing was written). The report gives its date, who started it, and what happened to each item:

| Outcome                   | What it means                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **added**                 | The item did not exist on the copy.                                                                                                                  |
| **updated**               | The copy took what production holds.                                                                                                                 |
| **already up to date**    | Nothing changed since the last follow.                                                                                                               |
| **kept on this copy**     | The item is kept on the copy: the follow did not touch it. The report says whether production changed it since.                                      |
| **copy's work set aside** | What had been written on the copy was moved into a new item of the copy, before the item took production's version. The link leads to that new item. |
| **draft removed**         | The report names it, for instance "draft 3.0 of X": production removed that draft, which the copy had received by a follow. The item itself stays.   |
| **item removed**          | Production no longer has the item, never published, which the copy had received by a follow: it leaves the copy.                                     |
| **failed**                | This item could not be written: the reason is given next to it. The other items were written.                                                        |

The report may also carry **warnings**, for instance a task skill whose consumed expertise is missing on the copy.

An item that changed on the copy during the follow (in the back office, or through an assistant) is not overwritten: it **fails**, and the next follow takes it up again.

## 5. What the copy follows, and what it never loses

### An item that came from production follows it in everything

Its active version, its draft, its audience, its archived state, whether it is offered to assistants, its title, category and scope are production's, with the same version numbers. A copy opens or closes nothing on its own: it shows what clients live on production. Each version received is marked as coming from production.

### The work done on the copy is never lost

When the follow has to replace something written on the copy, that content goes **as a draft into a new item of the copy**, which the follow never touches. That is the case of:

- **a draft written on the copy, when production brings a draft**; as long as production brings none, the copy's draft stays where it is;
- **a version published on the copy**, which production does not have.

That new item has the original item's identifier followed by a suffix (`<identifier>.copie`, then `.copie-2`…), and its title followed by "(travail de la copie)", since skills and expertises are written in French. It is kept to the platform company and not offered to assistants. The follow's report links to it.

### What production removes

A draft or an item never published that production removes leaves the copy, **if the copy had received it by a follow**. What the copy wrote itself is never removed.

### An item written on the copy

An item created on the copy, a skill being tried out for instance, is left alone **as long as production has no item with the same identifier**. If production has one, the item follows it from the next follow on, and what was written on the copy goes into a separate "(travail de la copie)" item. To try something on a copy, pick an identifier production does not use.

### Where each item comes from

On a copy, the lists and the page of a skill or an expertise carry a badge:

| Badge                    | What it means                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Not followed yet**     | The copy has not succeeded any follow yet: the first one will tell which of its items follow production (see above).     |
| **Follows production**   | The item came from production and follows it at each follow.                                                             |
| **Kept on this copy**    | The item came from production, but the follow no longer touches it (see below).                                          |
| **Written on this copy** | The item was created on the copy: the follow leaves it alone as long as production has no item with the same identifier. |
| **Copy's work**          | The item holds the copy's work set aside, or a duplicated version. The link leads to the original item.                  |

These badges and the actions below do not show on production.

## 6. Keep, follow again, duplicate

On a copy, the page of an item that came from production offers three actions:

- **Keep on this copy** detaches the item: the follow no longer touches it, and its report only says that production changed it. Useful to keep a version on trial for a few days.
- **Follow production** attaches it back. At the next follow, what was written on the copy goes into a new item (see above), and the item takes back what production holds.
- **Duplicate on this copy** creates an item of the copy holding the chosen version as a draft, to try something without touching the follow.

**Publishing on a copy.** Publishing an item that follows production offers the **Keep on this copy** box, checked by default: the item keeps what you publish. Unchecked, the item keeps following production, and the next follow sets the published version aside in a new item.

## 7. A feature skill born before its code

A new feature's skill is written on production, as a draft, before its code is deployed, then goes down to the developer's copy by the follow. Its draft may name an input or output schema the instance's code does not know yet:

- saving it warns, and a badge stays on the draft as long as the schema is missing from this instance's code;
- publishing it is refused, with a message saying why, until the code that declares the schema is deployed.

## When a follow fails

A **Failed** follow wrote nothing, and the section says why:

| Message                                                                                            | What to do                                                     |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Production could not be reached.                                                                   | Check the address and that production answers, then try again. |
| Production refused the read token: it may have been revoked.                                       | Create a new token on production and update the copy.          |
| Production answered with an error.                                                                 | Try again later; if it lasts, tell the technical team.         |
| Production's answer could not be read: the two instances may not run the same version of LePatron. | Bring the copy to production's version.                        |
| Production's address is not a valid https address.                                                 | Fix `SKILLS_SOURCE_URL`.                                       |

During an acceptance round, the copy's code is often newer than production's: a copy also accepts an answer in the previous format. An item the copy cannot read is refused alone: it **fails**, and the others are written.

## Revoke a token

When a copy is retired, or if its token may have leaked: on production, **Production and copies** tab, click **Revoke** next to the token, then confirm. The copy that used it can no longer read production, and its next follow fails with "Production refused the read token". A revoked token cannot be restored: to resume following, create a new one.
