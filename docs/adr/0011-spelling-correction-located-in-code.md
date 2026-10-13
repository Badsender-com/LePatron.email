# Spelling correction is a text generation action whose corrections the code places

- Status: proposed
- Date: 2026-10-12
- Epic: #1251

Correcting the spelling, grammar and typography of a field, a block or the whole email is an AI action of text generation, run by a Badsender skill on the group's text generation engine, with no new AI feature and no external proofreading service. The skill reads the visible text of each field, its merge tags protected, and answers corrections — the field, the text before, the text after, the reason —; it never sees nor returns the HTML. The code finds each "before" in the text nodes of the field and replaces it there only, and drops a correction it cannot find, finds twice, that straddles a tag or touches a merge tag. The panel lists the corrections to accept or ignore one by one, a new family of steps next to proposals; an accepted correction is written into the email at once and undone with the editor's own Ctrl+Z, and one not found anymore at that moment, because the text changed since, is not applied.

## Considered Options

- **An external proofreading service** (LanguageTool, Antidote), plugged in as an integration like DeepL for translation: reliable on spelling, but outside the skills and their logs, without Badsender's doctrine, with a second contract, and with no way for consultants to tune it.
- **A typography expertise per language**: Badsender cannot write and maintain one for every language its clients write in. The skill corrects by the conventions of the text's own language; an expertise of scope `correction` can still be added later, without code, for a rule of the house.
- **A new "Correction" AI feature**, enabled on its own: every action would then become a feature to configure. Correcting is still writing text the user accepts; a finer control of which AI actions a group exposes will come as such.
- **Letting the model rewrite the HTML of the field**: shorter, but a broken tag or merge tag would go unnoticed into the email. Placing the corrections in code means a mistake straddling a tag is not corrected, which is rare.
- **The whole corrected text as one proposal to apply**: the user could not refuse one change and keep the others.

## Consequences

- The whole email is the blocks of the email, corrected one at a time, one invocation each, so a block that fails loses only itself; the subject and the preheader field are not part of it. A failure of the feature itself (switched off, unavailable, signed out, no network) stops it. When the AI rate limit stops it, the panel waits for the delay the server gives and goes on, if that delay is short; a longer one stops it. The user can stop it at any time and keeps what it found.
- The quota: correcting the whole email costs one invocation per block with text, against the group's text generation rate limit. A long email can reach the limit; the pause above is the answer, not a larger limit for this action.
- Fields still holding the template's sample text are left out of a block or the whole email, and said so; a field the rendering hides is left out quietly; a field the user targets is corrected all the same.
- Only the expertise of scope `correction` is read: the transversal writing principles would push the skill towards rewriting. The skill manifest declares it, so the activation alert agrees.
- Placing a correction refuses more than a missing or repeated excerpt: a correction that brings a merge tag the text did not have, a control or bidirectional character, or an excerpt straddling two lines. A correction the text already holds (a non-breaking space the model could not see) is no loss and is not counted.
- An accepted correction the editor's undo took back shows as undone, and can be accepted again; Ctrl+Z (⌘Z) in the panel undoes in the editor.
- A field is targeted from the element being edited: its DOM id is matched against the text fields of its block. The AI button comes first in the text editor's toolbar, which is wider than a narrow canvas; on an element no field matches, it opens the block.
