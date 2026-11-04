# Writing, publishing and opening skills from an assistant

This page is for the Badsender team: the people who may manage the platform, that is the super admins. A company user sees none of these tools: their assistant reads LePatron without changing anything ([Connect an assistant](./connect-an-assistant.md)).

From an assistant connected with the writing right, you can:

- write drafts of skills and expertises;
- try them before they are published;
- publish a draft, in two steps;
- open a published skill or expertise to every company, or keep it to the platform company again.

## Connecting with the writing right

Connect the assistant as usual. On the consent screen, a box **"Also write, publish and open skills and expertises"** shows, unticked, for a super admin only. Tick it for an assistant of the Badsender team, and for it alone: it gives the connection the `skills:write` right.

That right is not enough on its own. At every call, LePatron checks again that you may manage the platform: if that right is taken from you, the writing tools are refused, even on a connection that had it.

Without the box, these tools do not show in the assistant.

## Writing a draft

| Tool                       | What it does                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `propose_expertise_change` | writes a change to an expertise in its open draft, or opens a new one |
| `propose_skill_change`     | the same for a skill                                                  |
| `create_expertise`         | creates an expertise, as a draft                                      |
| `create_task_skill`        | creates a task skill, as a draft                                      |

A draft is read by the Badsender team only. LePatron's users and the companies' assistants always read the published version.

## Trying a draft

The `use_drafts` tool turns the drafts mode on for the connection: every skill and expertise is then served at its latest draft, when it has one, the expertises a skill consumes included. Each content served from a draft says so.

The mode turns itself off after four hours, and at each new connection. Ask the assistant to reload the skills and expertises when it offers to.

## Publishing a draft, in two steps

The `publish_draft` tool publishes the open draft of a skill or an expertise. It takes two calls.

**First call: the check.** The assistant calls the tool without a key. Nothing is published. LePatron runs the publication guard, the same as in the back office:

- the features that use this skill or expertise;
- each test case of the feature skills concerned, with the active version and then with the draft;
- the feature skills without a test case.

The assistant shows you that result, then a **confirmation key**. A difference warns you, it never blocks: you decide.

**Second call: the publication.** If you agree, the assistant calls the tool again with the key. The draft becomes the active version, and LePatron's features read it at once.

Both answers also say what the publication warns of, without stopping it: for a task skill, the expertises it consumes that are not published, or that are kept to the platform company while the skill is open to every company.

The key is bound to that exact draft, to you and to an hour. The tool refuses it in these cases:

| Case                                                    | The tool's answer                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| the draft changed since the check                       | "The draft changed after it was checked: call publish_draft without a confirmation to check it again."  |
| the key is more than an hour old                        | "This confirmation key has expired: call publish_draft without one to check the draft again."           |
| the key is made up, or given for another item or person | "This confirmation key was not given for this draft: call publish_draft without one to check it first." |
| the item has no draft                                   | ""…" has no draft to publish: write one first, or it is already published."                             |

In the first three cases, run the check again.

For a major version, the tool takes the draft's changelog and release notes, or those you give the assistant. Without any, it writes "Publiée depuis un assistant (…)", with the application's name.

The publication is recorded on the version, as in the back office: who published, from which application, and the guard's outcome (number of cases, of differences, feature skills without a case).

Publishing shows nothing to the companies: the audience decides who reads a skill or an expertise.

## Opening or closing an audience

The `set_audience` tool changes the audience of a skill or an expertise in one call:

- `all` opens it to every company: in the editor's features, and in the assistants of the companies that have MCP access;
- `platform` keeps it to the platform company again.

Companies always read the active version, never a draft: the tool's answer says which one (`clientsRead`). A skill or expertise never published is not opened: ""…" was never published: a person publishes a version before it is opened." Nor is an archived one.

Closing an audience is immediate: the companies' assistants no longer read it at their next call.

The tool follows the same rules as the back office:

- **Opening a task skill:** the answer lists the expertises it consumes that stay kept to the platform company (`platformOnlyExpertises`): the other companies' assistants follow the skill without them. To open some of them too, ask the assistant to call the tool again with them (`openExpertiseIds`). Opening an expertise also applies it, at once, to the editor features of every company: choose them one by one.
- **Keeping an expertise to the platform company again:** the answer lists the task skills open to every company that consume it (`openTaskSkills`): they no longer receive it at the clients.

## Why the assistant asks you to confirm

`publish_draft` and `set_audience` are declared as tools that change LePatron, so assistants ask for your agreement before running them. Read what they are about to do before you accept: the decision is yours, the assistant only carries it.

## What the call log keeps

As for every MCP call, the log keeps the person, the application, the tool called, the item's identifier, the time, the duration and the outcome (succeeded or failed). It keeps neither the drafts' content nor the confirmation key. For `set_audience`, it also keeps which way the audience went (to `all` or to `platform`).

## If the tool refuses

| Answer                                                                                                                     | Cause                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| "Not allowed: publishing skills and expertises needs the skills:write scope and the right to manage the platform."         | the connection lacks the writing right, or you no longer manage the platform |
| "Not allowed: opening or closing skills and expertises needs the skills:write scope and the right to manage the platform." | the same, for the audience                                                   |

In both cases, connect the assistant again with the writing box ticked, if you may manage the platform.
