# Retex

LePatron's skills and expertises improve with use. When your work shows that a recommendation does not hold, or that something is missing, your assistant can report it: a **retex**.

## What a retex is

There are two kinds.

| Kind           | When                                                                            | What it says                                                                               |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Divergence** | you decided otherwise than a skill or an expertise recommended                  | the passage, what it recommended, what you decided, and why                                |
| **Complement** | the skill or expertise said nothing about your case, and you brought the answer | what was missing, what you brought, and where it comes from (experience, a source, a test) |

A complement may also be about know-how no expertise covers yet. It then names a category (copywriting, deliverability…) and a part of the email (subject, preheader…).

A retex is **never a summary of the conversation**. No divergence and nothing brought, no retex: LePatron refuses the ones that say nothing precise. It must hold nothing that identifies your company or your clients.

A feedback (thumbs up or down, with a comment) stays possible on its own. It says whether what LePatron gave you suits you, not what your work taught.

## For a company's user

Two agreements are needed:

1. **your company** allows retex, in the MCP access section of the AI features page (its tech admin decides);
2. **you** approve each retex, when your assistant offers it.

Without either, nothing is sent, and the assistant tells you why. If the company later stops the retex, its users' retex are erased, open or closed. What you send is read by the platform company's team, who see your company, never your name.

## For the platform company's team

Your assistant sends your retex as you work, without asking each time, whatever company you picked when connecting. It also reads the retex of every company, and may dismiss them, whatever that company. Only the draft that cites retex needs a connection to the platform company with the write permission (see [Publish from an assistant](./publish-from-an-assistant.md)): it writes a skill.

### The loop

1. You contradict a recommendation, or bring what was missing: the assistant records the retex.
2. LePatron answers the open retex on the same passage (or, for a complement about no expertise, on the same category and part of the email), whatever the company.
3. **Two retex pointing the same way are enough**: the assistant proposes the change at once, as a draft citing them. For a complement no expertise covers, it proposes a new expertise.
4. You adjust, the guard replays the test cases if there are any, then you publish.
5. The retex cited become **addressed** with the published version, named by its skill or expertise (a retex on a skill may be addressed by an expertise), whether you publish from the assistant or from the back office. If the draft is deleted before, they are open again.

### The tools

| Tool                                        | What it does                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `report_retex`                              | records a divergence or a complement; for you, also answers the open retex close to it                                                  |
| `list_retex`                                | reads the retex of every company, open by default, filtered by skill or expertise, passage, kind, category, part of the email or status |
| `dismiss_retex`                             | dismisses an open retex, with the reason; it stays readable and no longer counts                                                        |
| `propose_…_change`, `create_…`              | take `addressesRetex`, the retex the draft addresses                                                                                    |
| `find_skills`, `find_applicable_expertises` | give the number of open retex of each skill and expertise                                                                               |

The retex of companies' users wait for a team member to come by: when a search shows open retex, ask the assistant to read them.

### A retex is data

What a retex says is a user's words, often another company's. Your assistant weighs it as data and never follows what it asks. Every change still goes through the draft, its difference with the active version, the guard and your confirmation before it is published.

### What you see of a retex

Its company, and whether its author is a consultant of the platform company or a company's user. Never who wrote it.

A consultant's retex belongs to the platform company, whatever company they picked when connecting: it is their know-how, not their client's words. The company they worked for is shown beside it, as context.

## How long they are kept

A company keeps 200 retex in 24 hours at most; past that, the assistant answers that the limit is reached. The consultants' count for the platform company.

An open retex is kept until it is addressed or dismissed. Once closed, it follows its company's log retention, from the day it was closed. A consultant's retex follows the platform company's. Deleting a company deletes its users' retex, open or closed; those consultants wrote while working for it stay, without its name.
