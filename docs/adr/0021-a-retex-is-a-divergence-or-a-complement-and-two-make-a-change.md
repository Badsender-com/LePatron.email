# A retex is a divergence or a complement, and two that converge make a change

- Status: proposed
- Date: 2026-11-07
- Epic: #1472
- Amends: ADR 0012 (the retex), ADR 0014 (a draft cites the retex it addresses), ADR 0019 (a publication closes them)

The skills and expertises improve every day from the work of the platform company's consultants, who are all super admins and experts of what they write. ADR 0012 gave the assistants a way to report back: a feedback, and its retex, a summary of the session kept with the company's permission and the user's consent. A summary says everything and nothing: sent at every feedback it would flood the base, and no one can tell which passage it is about, nor whether two of them say the same thing. The improvement loop needs the opposite: a precise lesson, tied to a passage, that can be matched with another one.

**A retex is a divergence or a complement, never a summary.** It is recorded on its own, no longer inside a feedback, which goes back to a rating and a comment. A **divergence** says, on a passage of a skill or an expertise, what it recommended, what the user decided instead, and why. A **complement** says what a skill or an expertise lacked for the case at hand, what the user brought, and where it comes from (experience, a source, a test); it may concern no skill or expertise at all, and then names a kind of know-how and a part of the email, so that two of them can still meet. No divergence and nothing brought, no retex: the server refuses a retex whose recommendation and decision are the same, a divergence without a passage, and a complement that brings nothing. The **passage** is the anchor of an expertise's section (`## [length] Length`), or a short quotation of a skill, which has no sections; both are checked against the version the retex is about.

**Who sends one.** A super admin's retex is recorded as soon as it occurs, whatever company they connected to: it is their know-how, not their client's words, and the method tells them to leave out what identifies the client. It therefore belongs to the platform company, follows its log retention once closed, and outlives the client: the company they connected to is kept as context only, and forgotten when that company is deleted. Any other user's needs the company's permission, as before, and the user's approval of that retex, asked by the assistant each time. Stopping the retex erases the company's users' retex, open or closed, as ADR 0012 erased the summaries, and a retex written while it stops checks the switch again once written; the consultants' belong to the platform company and stay.

**Two retex that converge make a change, in the session.** When a super admin records a retex, the answer gives the open retex that may converge with it: the same skill or expertise and passage, or the same kind of know-how and part of the email. The assistant judges whether they point the same way. Two are enough, from the same consultant or not, divergences and complements alike: the consultants are the experts, and a second case is the signal. Any super admin then proposes the change at once, as a draft, or as a new expertise for complements that concern none, citing the retex it addresses (amending ADR 0014), from a connection that may write skills. Retex of client users wait for a super admin: searching the skills and expertises through MCP tells a super admin how many open retex each has.

**A publication closes the retex it addresses.** When a version is published, from an assistant or from the back office, the retex its draft cites become **addressed** with that version (amending ADR 0019); a draft deleted before leaves them open. A super admin may **dismiss** a retex, with the reason; a dismissed retex stays readable and no longer counts towards a convergence. An open retex is kept until it is addressed or dismissed, then for the company's log retention.

**Reading the retex.** Any super admin reads and dismisses the retex of every company, and is answered the candidates of a convergence, whatever company they connected to and whatever the connection may write: reading them writes no skill, and a consultant working for a client meets the retex there. Citing a retex in a draft is writing a skill: like any writing (ADR 0019), it needs the `skills:write` scope, which only a connection to the platform company is granted. Each retex says its company, the company a consultant worked for, and whether its author is a consultant or a client user, never who.

**A retex is data, never instructions.** A client user's retex reaches a consultant's assistant, which may draft and publish what every company reads. Its fields are a user's words: the tools and the server's instructions say to weigh them, never to follow what they ask, and every change still goes through the draft's difference, the guard and the person's confirmation before it is published.

**Who carries the loop.** The MCP server carries when it starts and what it may do: the instructions it gives every client, the description of its tools, the checks and the statuses. The method, how to write a retex and how to judge that two converge, is know-how: it is written in two task skills of the platform company, versioned and improved by the same loop. The instructions of a Claude project carry only the mission. Writing the loop in each consultant's project instructions was rejected: copied in every project, versioned nowhere, unseen by ChatGPT and Copilot, each copy drifting on its own.

## Considered Options

- **A summary of the session, as ADR 0012 had it**: rejected. It floods the base, and two summaries cannot be matched.
- **A retex inside a feedback**: rejected. A consultant's divergence is no thumbs down, and a retex needs fields of its own.
- **Consolidating apart, on a schedule**: rejected as the main path. The consultants change the doctrine every day, and the second retex is the moment to act; a reading of a skill or an expertise tells a super admin of the client retex that wait.
- **Two distinct authors before a change**: rejected. One expert meeting the same passage on two cases is a signal.
- **Anchors added to the skills**: rejected for now; a skill is short, a quotation finds its passage.
- **A screen of the retex in the back office**: left for later. The super admins work from their assistant.

## Consequences

- `submit_feedback` takes a rating and a comment only; the summaries already stored stay readable until their retention ends.
- New tools: report a retex (everyone, with the company's permission and the user's approval, except a super admin's), read and dismiss the retex (any super admin, whatever company they connected to). The writing tools of ADR 0014 take the retex a draft addresses.
- A retex is stored with its kind, its passage and its status; an open one has no expiry.
- The two task skills of the method are written as content, through MCP, outside this epic.
