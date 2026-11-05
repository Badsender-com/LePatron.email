# The right panels share one shell; comments move to Vue, an approval is an event, and an email is ready by one rule

- Status: proposed
- Date: 2026-11-05
- Completes: ADR 0010 (one right-hand place, one open at a time), ADR 0003 and 0009 (quality control)
- Amends: ADR 0004 (who may approve an email)
- Design reference: `docs/design/refonte-panneaux-droite/`

ADR 0010 gave the comments, the quality control and the AI panel one place and one "which panel is open" state, but each panel still draws its own header, close button, foot, empty and loading states, with three sets of tokens; the comments panel is Knockout markup that Vue cannot wrap. We redesign the three panels at once, on one grammar the left bar can later take up, and settle on the way four rules the panels disagreed on.

**One Vue shell, one root per panel.** A shell component draws what every panel has: the non-modal dialog, the header and its close button, the scrolling body, the foot, the empty, loading and error states. The Knockout `rightPanel` binding keeps what it does today on the panel's container: one panel open at a time, hidden and inert when closed, Escape, focus on open and back to the button that opened it. Each panel keeps its own Vue root inside its container, and one mixin mirrors Knockout observables into Vue, instead of three hand-written bridges.

**The comments panel is rewritten in Vue.** Its state moves to a controller of Knockout observables with no DOM, as the AI panel's did (ADR 0010, amendment), so the pieces that live in the canvas and stay in Knockout read and write the same state: the comment markers rail beside the email, the "Comment this block" block tool, the quality control's "Add a comment", the comment counter. The panel is rebuilt directly in the new design, rather than first styled in Knockout then ported.

**The panel buttons leave the top bar for a vertical rail**, below the top bar, on the right edge. An open panel sits between the rail and the canvas and pushes the canvas; below about 1450 px of window width, the email partly goes under the open panel. The left bar does not fold to make room.

**The filter of the comments only reads; the target of a new comment is explicit.** Filtering the list on a block no longer means commenting that block. The foot of the panel names the target ("Sur : Tout l'email" or the selected block), which follows the canvas selection by default and can be changed. The active marker of the rail is the target's.

**Comments refresh every 30 seconds** while the panel is open and the browser tab is visible, and at every reopening, with one request per cycle. A comment already shown is updated in place, so a reply or an edit under way is not lost; new comments wait behind a "N nouveaux commentaires · Afficher" pill rather than shift the list under the reader. The server checks the access to the email with a light read, not the whole email. Panel closed, nothing refreshes: the counter and the markers rail keep what the editor loaded at start, and catch up at the next opening.

**An approval is an event of the thread, not a comment to resolve.** It stays in the comments collection, with its `decision`, but has no type, no priority and no block: the server forces them, and refuses to change them afterwards. It counts nowhere a comment counts: neither in the unresolved counters of the server, the editor and the email list, nor in the rail. Its default text is "Bon pour envoi" ("Ready to send"). It is neither resolved nor reopened. Its author withdraws it by deleting it. An email is approved when its last root comment not deleted is an approval, as before, and no blocking comment is open (below). A new root comment lifts the approval, and the thread says so; deleting that comment makes the email approved again; when the last two root comments are approvals, withdrawing the later one leaves the email approved by the earlier.

**No approval while a blocking comment is open.** The button is disabled with the reason; the server refuses the approval (409 `COMMENT_APPROVAL_BLOCKED`) when a root comment, not an approval, is unresolved and blocking; and computing "approved" requires no such comment, so reopening an older blocking comment, or a race between the check and the insert, lifts the approval by itself.

**Approving is a capability of its own**, `mailing.approve`, held by the reviewer and the three admins, not by the writer nor the regular user. See the amendment of ADR 0004.

**An email is ready when no error or warning is left unignored and every check ran**; an info counts only if it is blocking. It is the rule the top bar badge already called `cleared`, renamed `ready`, and now the one rule for the badge of the rail button, the card of the quality panel and the banner of the send test tab, which counted errors only; red means blocking, the accent means a number. What blocks the download and the ESP export does not change: it reads the blocking findings, not this rule.

**The AI tools are hidden from whoever may not edit the content**, with every way into them: the server tells the editor, once, whether this user may use text generation on this email, from the same rule as the text generation routes.

## Considered Options

- **A Knockout shell repeating the classes of the Vue one**, the comments staying in Knockout: two implementations of the same grammar, which drift as soon as one changes; and the comments panel, the largest file of the editor, stays the least tested.
- **One Vue root for the three panels**: mounting replaces the containers that carry the `rightPanel` binding, so hidden, inert, Escape and focus would have to be rewritten in Vue while the open state stays in Knockout.
- **The panel over the canvas, without pushing it**: the AI panel follows the selection in the canvas and corrections go to a block; a panel covering the email hides what it talks about, at every width.
- **An `Approval` model of its own**: "approved" would compare two collections, with their own routes and deletion, for no gain over a `decision` already stored.
- **An approval created resolved**: it would show folded, and reopening it would put it back in the counters.
- **A dedicated approval route**: it would change the route list and the guard test for a single flag on a comment; the capability is checked where the comment is created.
- **Hiding the AI tools in the editor from the user's capabilities**: the capabilities arrive after the editor starts, so the button would appear late and shift its neighbours, and each way in would need its own check.

## Consequences

- The comments panel is migrated in steps that each leave the editor working: the rail and the controller first, then the views, then the switch; the old panel and its styles are deleted at the end.
- Approvals already stored as "blocking" or on a block stop counting as soon as the counters exclude approvals; no migration is needed for the counts.
- The "N errors are still to fix" banner of the send test tab now counts warnings too: its wording changes.
- Escape closes the innermost open menu of a panel (the target, the type, the priority) before the panel. The disabled "Approuver l'email" button is described by its visible reason; each rail button names its panel and what its badge says; the new comments pill is announced politely.
- A client may approve with a stale view: the server rule and the 30-second refresh, not the disabled button, keep a blocking comment from being approved over.
