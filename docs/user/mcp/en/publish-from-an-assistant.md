# Writing, publishing and opening skills from an assistant

This page is for the platform company's team: the people who may manage the platform, that is the super admins. A company user sees none of these tools: their assistant reads LePatron without changing anything ([Connect an assistant](./connect-an-assistant.md)).

From an assistant connected with the writing right, you can:

- write drafts of skills and expertises;
- try them before they are published;
- publish a draft, in two steps;
- open a published skill or expertise to every company, or keep it to the platform company again.

## Connecting with the writing right

Connect the assistant as usual, and pick the platform company. On the consent screen, a box **"Also write, publish and open skills and expertises"** shows, unticked, for a super admin only, and only once the platform company is picked: it is not offered on a connection to a client company. Tick it for an assistant of the platform company's team, and for it alone: it gives the connection the `skills:write` right.

That right is not enough on its own. At every call, LePatron checks again that you may manage the platform and that the connection is to the platform company: if either no longer holds, the writing tools are refused, even on a connection that had the right.

Without the box, these tools do not show in the assistant.

## Writing a draft

| Tool                       | What it does                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `propose_expertise_change` | writes a change to an expertise in its open draft, or opens a new one |
| `propose_skill_change`     | the same for a skill                                                  |
| `create_expertise`         | creates an expertise, as a draft                                      |
| `create_task_skill`        | creates a task skill, as a draft                                      |

A draft is read by the platform company's team only. LePatron's users and the companies' assistants always read the published version.

## Trying a draft

The `use_drafts` tool turns the drafts mode on for the connection: every skill and expertise is then served at its latest draft, when it has one, the expertises a skill consumes included. Each content served from a draft says so.

The mode turns itself off after four hours, and at each new connection. Ask the assistant to reload the skills and expertises when it offers to.

## Publishing a draft, in two steps

The `publish_draft` tool publishes a draft of a skill or an expertise. It goes in two steps, with a check in between that runs on the server.

**First step: the check.** The assistant calls the tool without a key. Nothing is published. LePatron starts the publication guard, the same as in the back office, and answers at once, with what it will replay:

- the features that use this skill or expertise;
- the number of AI calls the check makes.

The check runs on the server, three AI calls at a time at most: count a minute or more. The assistant reads it again with `read_publication_check`, which changes nothing, until it is done. Once done, it shows:

- each test case of the feature skills concerned, with the active version and then with the draft;
- the feature skills without a test case;

and a **confirmation key**. A difference warns you, it never blocks: you decide. A check that could not end says so; start it again.

**Second step: the publication.** If you agree, the assistant calls `publish_draft` again with the key. The draft becomes the active version, and LePatron's features read it at once.

The first answer and the publication also say what the publication warns of, without stopping it: for a task skill, the expertises it consumes that are not published, or that are kept to the platform company while the skill is open to every company.

**An item with several drafts.** When a skill or an expertise has more than one draft, the tool does not choose: it lists them, and the assistant gives the version to publish (`version`, for instance `2.1`) at every call. With one draft, nothing is to give.

**Changelog and release notes.** A major version is published with its changelog and its release notes, as in the back office: the draft's, or those you give the assistant. Without them, the tool refuses before the check, and the assistant has to write them. The key is bound to them: give the same at both steps.

**On a copy** (staging, development), the item published is kept on the copy, as the back office's publication offers by default: the next follow of production does not undo it. The answer says so (`keptOnCopy`).

The key is bound to that exact draft, to you, to the changelog and release notes checked, and to an hour. The tool refuses it in these cases:

| Case                                                                           | The tool's answer                                                                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| the draft changed since the check                                              | "The draft changed after it was checked: call publish_draft without a confirmation to check it again."                                          |
| the key is more than an hour old, made up, or given for another item or person | "This confirmation key is not valid for this draft, or has expired: call publish_draft without one to check the draft again."                   |
| the changelog or release notes are not the ones checked                        | "The changelog or release notes differ from the ones checked: give the same ones, or call publish_draft without a confirmation to check again." |
| the item has several drafts and no version is given                            | ""…" has several drafts: give the version to publish.", with the drafts                                                                         |
| the item has no draft                                                          | ""…" has no draft to publish: write one first, or it is already published."                                                                     |

In the first three cases, run the check again.

The publication is recorded on the version, as in the back office: who published, from which application, and the guard's outcome (number of cases, of differences, feature skills without a case).

Publishing shows nothing to the companies: the audience decides who reads a skill or an expertise.

## Opening or closing an audience

The `set_audience` tool changes the audience of a skill or an expertise:

- `all` opens it to every company: in the editor's features, and in the assistants of the companies that have MCP access;
- `platform` keeps it to the platform company again.

It does so in two calls, as a publication does:

1. The first call changes nothing. It answers the version companies will read (`clientsRead`), what the change leaves behind, and a confirmation key.
2. Once you agree, the assistant calls the tool again with the same arguments and the key: the audience changes. The key holds for an hour, for this change, for you alone, and for the item as it was checked: if it changed in between, in any way, the tool refuses (""…" changed after the check…"), and checking again is enough.

When the audience is already the one asked, the tool says so (`changed: false`) and changes nothing, at either call. On a copy (staging, development), the item is kept on the copy, so the next follow of production does not undo the change; the answer says so (`keptOnCopy`).

Companies always read the active version, never a draft. A skill or expertise never published is not opened: ""…" was never published: publish a version before opening it." Nor is an archived one.

Closing an audience is immediate: the companies' assistants no longer read it at their next call.

The tool follows the same rules as the back office:

- **Opening a task skill:** the answer lists the expertises it consumes that stay kept to the platform company (`platformOnlyExpertises`): the other companies' assistants follow the skill without them. To open some of them too, ask the assistant to check again with them (`openExpertiseIds`), then to confirm. Opening an expertise also applies it, at once, to the editor features of every company: choose them one by one.
- **Keeping an expertise to the platform company again:** the answer lists the task skills open to every company that consume it (`openTaskSkills`): they no longer receive it at the clients.

## Why the assistant asks you to confirm

`publish_draft` and `set_audience` are declared as tools that change LePatron, so assistants ask for your agreement before running them. Read what they are about to do before you accept: the decision is yours, the assistant only carries it.

## What the call log keeps

As for every MCP call, the log keeps the person, the application, the tool called, the item's identifier, the time, the duration and the outcome (succeeded or failed). It keeps neither the drafts' content nor the confirmation key. For `set_audience`, it also keeps which way the audience was asked to go, and whether the call only checked it (`audience:all:check`) or applied it (`audience:all`, `audience:platform`).

## If the tool refuses

| Answer                                                                                                                                                            | Cause                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Not allowed: publishing skills and expertises needs the skills:write scope, the right to manage the platform, and a connection to the platform company."         | the connection lacks the writing right, is to a client company, or you no longer manage the platform |
| "Not allowed: opening or closing skills and expertises needs the skills:write scope, the right to manage the platform, and a connection to the platform company." | the same, for the audience                                                                           |

In both cases, connect the assistant again to the platform company with the writing box ticked, if you may manage the platform.
