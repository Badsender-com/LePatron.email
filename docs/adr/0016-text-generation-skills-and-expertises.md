# Text generation runs on Badsender skills and expertises, as its own AI feature

- Status: proposed
- Date: 2026-10-05
- Epic: #1163

The editor's first text generation (subject, then preheader) is built on the Skills module rather than on a prompt in the code: the prompts (skills) and the Badsender know-how they read (expertises) are data that consultants write, version and test in the admin, without a deploy. The feature's code only composes each invocation's input — the email's text as the editor shows it, the email type when known, the applicable expertises for one scope — and chains the invocations: three subjects, the user picks one, then three preheaders built from it. The subject is optional for the preheader (#1180): when the user has set it in the sending platform, the preheaders are built from the email's text alone; this amends the earlier wording, where a preheader always followed a picked subject. Text generation is an AI feature of its own, with its own integration and model, and never falls back to the generic skill engine, so a group opens it without opening every skill.

Configuring text generation belongs to the company's tech admin and the super admin, as translation does on the same page; using it belongs to every role that may edit an email's content, the reviewer excepted. A request is served, counted and logged in the email's company, whoever makes it, a super admin included (ADR 0002), and reads the expertises open to that company's audience (ADR 0013). The editor offers the button only when the feature is on and both skills are open to the company; a skill closed to the company reads as "unavailable", as a missing one does.

## Considered Options

- **A prompt in the code**: faster to ship, but every wording change of the doctrine would need a developer and a deploy, and nothing would be traced per expertise version.
- **The generic 'skill' engine for every client feature**: one switch would open all AI features at once, and the model could not later be restricted per feature.
- **The server reads the saved mailing**: rejected, the user generates from what they see, saved or not; the server still loads the mailing to check access and read its type.
- **One invocation for subject and preheader together**: rejected, the preheader must complement the subject the user actually picked.

## Consequences

- Whatever can be counted or checked is computed in code, never by the model: visible length, mobile cut, personalization variables, emoji position, fake reply prefixes. A proposal breaking a checkable rule is dropped before the user sees it, with no retry; length is shown, never used to drop.
- Proposals are screened with the quality control's own rules and the company's thresholds (ADR 0009), so the editor never gives two verdicts on one text; a preheader that repeats the picked subject is dropped.
- "The email's text as the editor shows it" is read from the editor's rendering, not from its content model: the model holds every field a template declares (hidden parts, other brands' variants, unused list items), and only the rendering has applied the template's display rules. Header and footer blocks, the frame of the email, are left out, and so is a text still at its template sample value.
- Nothing is written into the email until the user picks a proposal. When the email has no subject field (metadata off) or the template no preheader, the proposal is offered to copy instead.
- Requests that reach an AI provider are capped in size and counted per user and per company, in shared windows held in the database, so the limit holds across instances; translation goes through the same limit. The caps come from the configuration, overridable per environment without a deploy; a cap per company is tracked in #1659. A request refused by the user's own window counts against that user, never against the company's daily window.
- The content of an invocation (the text sent, the instructions, the answer) is logged unless the company turns it off, with a switch in its settings, on by default, held by its tech admin; the metadata (author, skill, model, tokens, cost, status) are always logged. Each change of the switch is a security event (`ai-log-content.kept`, `ai-log-content.not-kept`), with its author and company, like the other company switches.
- The skill writes in the language of the content it receives: a mailing has no language of its own.
- The feature depends on data that must exist in every environment (two active skills, their expertises); a missing skill is a configuration error, reported as "unavailable", not as a provider outage.
