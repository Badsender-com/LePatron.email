# Skills are feature skills or task skills, and skills and expertises have an audience

- Status: proposed
- Date: 2026-10-29
- Epic: #1290
- Extends: ADR 0012

The expertises and skills Badsender writes are meant to reach the clients through MCP, and many will have no LePatron feature behind them, at first or ever. The skills written so far show two kinds that the app did not tell apart. **A feature skill** is a pure function a LePatron feature calls: an input template, an input and output schema declared in the code, a JSON output contract the server checks (the subject and preheader generation, the spelling correction). **A task skill**, most of them, is a procedure written for an assistant: read a report the user provides, review an email against a checklist. It takes files, runs steps and a quality check, produces a deliverable, and has neither template nor schema. Both stay one entity, versioned, rated and logged the same way; the nature says how the skill is served.

**Through MCP**, a task skill is a prompt the user picks, a resource the assistant reads, and a result of `find_skills`, so that an assistant can pick it itself when the request calls for it: an MCP prompt is only ever chosen by the user. A task skill names, in order, the expertises it consumes, and its prompt embeds their active versions: the procedure runs the Badsender way without the assistant having to look for them. A feature skill is served only when a super admin marks it so, with arguments taken from the placeholders of its template (refined by its schema when the code has one), and never its JSON output contract, which only LePatron reads. Publishing a skill for assistants needs no deployment.

**Every skill and expertise has an audience**: the platform group, or every subscribed group. A new one starts with the platform group, where the Badsender team uses and proves a first draft before opening it; the audience is the gate between a draft that works and one sold to clients. The MCP server applies it on every list, read, search and prompt. A brand charter is not a skill with a narrower audience: it is a group's writing guidelines, which belong to its CRM governance.

## Considered Options

- **A setting per skill and expertise for where it is served** (in the app, through MCP, both): rejected. No expertise written so far had a reason to stay out of MCP, and the one feature skill that should (the spelling correction, whose input the editor builds) is covered by the mark on feature skills. What does vary is who may read it.
- **Prompt arguments from the code's schema registry only**: rejected, a skill for assistants would wait for a deployment, and task skills have no schema.
- **The expertises of a task skill found by scope and category** (`findApplicable`): kept for feature skills, rejected for task skills, whose procedure reads named expertises in a given order.
- **Audiences of chosen client groups**: not now; the case that called for them, client brand charters, goes to the CRM governance.

## Consequences

- The skills and expertises back office gains the nature, the procedure of a task skill, its ordered expertises, the mark of a feature skill and the audience (#1344, #1345).
- The skills and expertises that exist get every subscribed group as audience, so that the first MCP version behaves as decided in ADR 0012.
- Bringing the skills and expertises written outside LePatron into it is an epic of its own: it reclassifies as expertises the "skills" that are knowledge, sets each one's nature, audience and consumed expertises, and moves client charters to the CRM governance.
