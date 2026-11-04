# Following production's skills and expertises

**Production** is the source of skills and expertises: the Badsender team writes them there, publishes them there and opens them to clients there. The other instances, staging or development, are **copies**: they do not author what production holds, they receive it. A copy follows production **on demand**, from its back office, and **every night**.

For **super admins** only, in **Settings › Super admin › Skills & Expertise**, **Sync** tab.

To move a few items once through a file, see [Export and import skills](../../skills-export/en/export-import.md) instead.

## 1. On production: create a read token

A copy reads production with a **read token**. A token reads nothing but the skills and expertises: no emails, no users.

1. On production, **Sync** tab, **Read tokens** section, click **Create a token**.
2. Give it a **Name**: the copy it serves, for example "Staging". One token per copy: you can revoke the one you retire without touching the others.
3. The token is shown **once**. Click **Copy**, then hand it to the person who configures the copy. **I saved the token** can only be clicked after copying.

The list then shows each token with its creation date and its last use ("never used" until the copy has used it). The token itself is never shown again: if it is lost, revoke it and create another one.

## 2. On the copy: configure it

A copy is configured through its **environment variables**, not in a page: the token is neither stored in the database nor shown in the browser. This is done by whoever deploys the instance (see [DEPLOYMENT.md](../../../DEPLOYMENT.md)).

| Variable              | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `SKILLS_SOURCE_URL`   | Production's address, in https, for example `https://production.example` |
| `SKILLS_SOURCE_TOKEN` | The read token created at step 1                                         |

On production itself, both variables stay unset. Changing production means changing these variables, then restarting the instance.

Once the copy is configured, the **Sync** tab opens with a **Follow production** section, showing production's origin (its address, never the token). Without configuration, this section does not show.

## 3. Follow production

### On demand

Click **Follow now**. The follow first reads production's whole answer, then applies it item by item. When it ends, the skills and expertise lists reload, and the section shows the **last follow**: how it ended, when, who started it, and how many items each outcome holds.

| Outcome                | What it means                                                         |
| ---------------------- | --------------------------------------------------------------------- |
| **added**              | The item did not exist on the copy.                                   |
| **updated**            | The copy took what production holds.                                  |
| **already up to date** | Nothing changed since the last follow.                                |
| **kept on the copy**   | The copy keeps its own (see below).                                   |
| **failed**             | This item could not be written; the reason is under **Failed items**. |

A follow **Succeeded**, **Partly succeeded** (at least one item failed, the others were written) or **Failed** (nothing was written). One follow runs at a time.

### Every night

Every night, around 3:00 (UTC), the copy follows production on its own, as if the button had been clicked. The last follow then reads "by the nightly follow".

## What the copy takes, and what it keeps

The copy shows what clients live on production:

- **a version active on production arrives active** on the copy; the copy's former active version is archived;
- **a draft on production arrives a draft**;
- **the state, the audience and whether it is offered to assistants** are production's: a copy opens or closes nothing on its own;
- a version the copy holds **at the same number** is rewritten with production's content: production is the reference.

The copy keeps its own in three cases:

- **what exists only on the copy stays**, untouched: a skill being tried out, for instance;
- **a copy ahead keeps its version**: if its active version is newer than production's, the item is not touched. No follow ever goes back;
- **a copy's draft newer than production's is never overwritten.**

A follow never goes up to production: what is written on a copy stays there.

## When a follow fails

A **Failed** follow wrote nothing, and the section says why:

| Message                                                                                            | What to do                                                     |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Production could not be reached.                                                                   | Check the address and that production answers, then try again. |
| Production refused the read token: it may have been revoked.                                       | Create a new token on production and update the copy.          |
| Production answered with an error.                                                                 | Try again later; if it lasts, tell the technical team.         |
| Production's answer could not be read: the two instances may not run the same version of LePatron. | Bring the copy to production's version.                        |
| Production's address is not a valid https address.                                                 | Fix `SKILLS_SOURCE_URL`.                                       |

## Revoke a token

When a copy is retired, or if its token may have leaked: on production, **Sync** tab, click **Revoke** next to the token, then confirm. The copy that used it can no longer read production, and its next follow fails with "Production refused the read token". A revoked token cannot be restored: to resume following, create a new one.
