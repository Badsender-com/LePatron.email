# Production is the source of skills and expertises; copies follow it, and what a feature uses is guarded

- Status: proposed
- Date: 2026-11-05
- Epic: #1420, #1421, #1422
- Amends: ADR 0013 (one doctrine, thin skills), ADR 0014 (an assistant may publish), ADR 0018 (a copy reads production)

Loading some sixty skills and expertises written outside LePatron, then moving them to a test instance, showed two blocks. Every imported item arrived as a draft to publish by hand, one by one. And the platform company's team, who want to improve their skills and expertises every day from an assistant, could only draft there, then go to the back office to publish. Behind both: no instance was the reference, and a skill that a feature uses was treated like any other, so the only safety was to change nothing.

**Production is the source.** The platform company's team writes, publishes and opens skills and expertises to clients in production, from the back office or from an assistant. A feature skill born with a new AI feature is written there too, as a draft no client sees, and published the day the feature ships. Staging and development are **copies**: they never author what production holds, they receive it.

**A copy follows production by itself.** A copy pulls production, on demand from its back office and every night, with a read token a super admin creates and revokes in production's back office, configured on the copy with production's address. What is active in production arrives active, a draft arrives as a draft, and the audience and the served-to-assistants mark come with it: a copy shows what clients live. What exists only on the copy stays, and a local draft newer than production is never overwritten, as no import ever goes back (ADR 0018). A file imported by hand keeps the rule of ADR 0018: everything arrives as a draft, for the platform company. ADR 0018 rejected a link between instances for a one-off transfer; a copy that must follow production every day is the case it did not cover.

**Two states, and a level LePatron works out.** A version stays a draft or active; the published version keeps the name "Active". Active is not open to clients: the audience stays the gate between what the team uses and what clients read through MCP (ADR 0013), so a version can be proven inside the platform company before every company reads it. **Used by a feature** is not a state anyone sets: LePatron works it out from the expertise filters each feature declares and from the skills features call, so it cannot be forgotten or wrong.

**The doctrine lives in the expertises.** The platform company's know-how is written once, in expertises, and improves continuously; skills stay thin. A feature skill and a task skill on the same subject read the same expertises, as the subject line generation and the subject line task already read the subject line doctrine. A feature reads the active version of its expertises at every call: a doctrine improved in production reaches the feature at once, with no developer, years after the feature was written. A skill with two faces, a contract for the feature and a procedure for an assistant, was rejected: one version would hold two contents to keep in step, and the doctrine, which is what matters, is already shared.

**Publishing what a feature uses is guarded, not blocked.** When the version about to be published is used by a feature, LePatron first replays the **test cases** of the feature skills concerned with it, and shows each one before and after. The person decides: a failure warns, it does not block, since an AI's output has no automatic pass or fail. Test cases live in the feature skill's version, where the model already keeps them: they travel with an export and a sync, and the golden runs proven in the playground become test cases. Blocking on a failed case was rejected for that reason; the activation impact alone was rejected because it lists what changes without showing how.

**An assistant may publish and open, for whoever may manage the platform.** With the `skills:write` scope (ADR 0014), an assistant may now publish a draft and change an audience, in two steps: the tool first runs the guard and answers the before and after, and publishes only on an explicit confirmation in a second call. Both tools are marked destructive, so the client always asks before running them. ADR 0014 kept both gates in human hands by keeping them in the back office; they stay in human hands, at the confirmation the person gives in the conversation, with the same guard in front of them.

## Consequences

- Three epics, each delivered on its own: a copy follows production; the guard at publication (the computed level and the replay of test cases); publishing and audience from an assistant.
- The back office of a copy shows where its skills and expertises come from and when it last followed production; production's back office lists the read tokens.
- The test cases of the feature skills that exist are to be written before the guard can say anything for them.
