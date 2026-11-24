# A composed block holds rows of columns, and emits its own stylesheet

- Status: proposed
- Date: 2026-10-08
- Epic: #1194

The Block Builder shipped single-column: a composed block was a flat list of elements, and every style it produced was inline. Columns break both halves of that. A block now holds **rows**, each row holds **columns**, and each column holds elements — because a saved block has to be a whole structure (a one-column title row, then a two-column row with an image facing text and a button) rather than one row that only becomes a layout once several blocks sit next to each other. And because a stacking rule cannot be inlined by definition — it only means anything inside a media query — the generator now derives a stylesheet from the state alongside the markup, recomputed at export and never stored.

## Stored shape

- **In memory, a composition is always made of rows.** Every reader, the modal and the generator included, works on rows; there is no flat view beside them.
- **On disk, the version number says the shape.** A composition of one row holding one column, with no row setting, is written `{ v: 1, elements }`. Any other composition is written `{ v: 2, rows }`.
- **Rendering follows the same rule.** A composition that would be written `v: 1` renders flat, as it did before columns: the elements' own tables, with no table of column cells around them. Anything else renders as rows of percentage cells. So a block stored in `v: 1` reads as one row of one column, renders identically, and is written back identically.
- **The server keeps `builderState` as it was sent.** It reads the state to rebuild the markup, and checks that it can be read, but it never normalises the stored string: what the author's editor wrote is what the next editor reads, and the one copy that has to match the generator, the markup, is the one the server regenerates.

A rollback to a version without columns only loses the blocks that use the new structure: several columns, or several rows. A block of one row and one column is still `v: 1`, which that version reads. A `v: 2` block is unreadable there: the older editor offers to replace it with an empty block, and applying that loses the composition. That cost is accepted, and kept to the blocks that could not be written any other way.

## Bounds

- **More than 50 rows (`MAX_ROWS`): the composition is refused, not folded.** `parseState` returns `null`, and the server answers `BLOCK_BUILDER_STATE_UNREADABLE`. Refuse rather than lose: folding the extra rows into the last one would rewrite a composition nobody asked to change, and the next save would store the rewrite. A refusal leaves the stored block as it was and tells the author.
- **An entry of `rows` that is not an object is ignored.** It holds nothing to keep.
- **More than four columns (`MAX_COLUMNS`) in a row: the extra columns are folded into the fourth.** Their elements are appended to it, in order, and the widths are recomputed: kept when the four still add up to 100 with no column under 10%, equal shares otherwise, the remainder going to the last column. A layout nobody can see any more is a visible problem; a paragraph that silently disappeared is not.

## Row settings: the space between columns

A row of several columns carries two settings, independent of each other, set in the structure panel (#1683):

- **Gutter (desktop)**: `gutter`, the horizontal space between the columns, 0 to 40 px. It is inline padding on the cells, half of it on each side that faces another column and none on the outer edges of the row: padding on a table cell is what Outlook on Windows lays out natively, and the cells keep their percentage widths. An odd gutter gives the extra pixel to the left column of each pair, so the two halves always add up. An element told its column's width (an image's `width` attribute) is told the column minus that padding.
- **Stack spacing (mobile)**: `stackSpacing`, the vertical space between the columns once they stack on a phone, 0 to 40 px **in steps of 4**. On a phone the gutter does not apply: the stacked columns take the full width.

Both only exist on a row of several columns. They are neither offered nor stored for a row of one column, which stays flat (see "Stored shape"); a row that goes down to one column loses them. A setting at 0 is not stored at all, so a row at the defaults is written and rendered byte for byte as before the settings existed. Read from storage, a setting is kept only when it is a number: rounded to whole px, brought within the bounds, the stack spacing rounded to its step; anything else is dropped. No other value reaches the markup or the stylesheet.

**The mobile half stays a closed list.** The derived stylesheet holds only rules the generator owns, from a list it fixes, never a stored value. So the stack spacing does not write its value into a rule: it picks a generated class, one per step (`lp-stack-spacing-4` … `lp-stack-spacing-40`), carried by every stacked cell but the last. A row with a gutter puts `lp-gutter` on its cells, which drops their side padding on a phone. That is why the stack spacing goes by steps: forty values would be forty rules, ten keep the list short, and a step of 4 px is finer than anyone tells apart on a phone. The panel says the value is rounded.

**The classes are decided per cell**, since the last cell of a spaced row carries no spacing below it, and one function (`rowClasses` in `row-markup.js`) decides them for both the markup and the stylesheet.

## The MARKUP context

Every slot of a compiled component declares the escaping context its value goes through. **MARKUP is the only context that escapes nothing.** It exists because a column cell has to contain the rendered HTML of its elements, and escaped markup is destroyed markup.

It is reserved to **layout components** (`kind: 'layout'` in the manifest), whose slots only the generator fills, with markup it built itself from escaped values. An element's slots are filled from the stored state, from what a user typed, so an element may never declare one. The compiler refuses a MARKUP slot outside a layout when the components are built (`scripts/block-builder/component-checks.js`), and the template engine refuses it at run time too, so the rule does not rest on the build alone.

## The author's stylesheet and the derived one

An export carries two stylesheets, gated differently because they are different things. The rule lives in one place, `exportedHeadCss` in `packages/shared/head-css/exported-head-css.js`. Each side only collects its inputs from its own content model: `headCssToExport` in `packages/editor/src/js/ext/head-css/exported-css.js` (export and canvas preview) and in `packages/server/mailing/head-css-export.js` (the copies the server writes, such as a translated duplicate).

- **The derived stylesheet is always kept.** It is computed from the composed blocks of the email, so it exists only while one of them has a row of several columns. No gate, no flag.
- **The author's stylesheet (head CSS) is kept while the email holds an HTML code block**, and only then. A composed block does not keep it: an email whose only synthetic block is composed exports the derived stylesheet and nothing else. This is the rule of the head-CSS channel, which this slice does not reopen ([head-css-channel plan, §4](../plans/head-css-channel.md#4-décisions)). Left out of the export, the author's CSS is not deleted: it stays stored, and comes back with an HTML code block.
- **Derived first, author last.** At equal specificity the last rule wins, so a hand-written rule can still override a generated one. The exception is what CSS only reads at the top of a stylesheet: the author's leading `@charset`, `@import`, `@namespace` and `@layer` statements go above the derived rules, since a browser ignores an `@import` that follows a rule.
- **The `lp-` prefix belongs to the generator.** Nothing refuses an author's rule on an `lp-` class, but it is not a supported hook: the generator may rename or drop its classes.

## Rights

Composing a block is editing an email, with nothing granted on top:

- **Server.** A composed block reaches the database through two writes, and both go through `normalizeAndGuardSyntheticContent`. The email save (`PUT /mailings/:mailingId/mosaico`) needs `mailing.edit-content`, finds the email through `addGroupFilter` (the user's company), then `assertUserCanEditMailing` (write access to its workspace or folder). The block library needs `block-library.add` to save a block, and the company admin to update or delete one, with the company checked from the request.
- **Template flag.** `blockBuilderEnabled`, set by a super admin on the template. Flag off, a composed block the email does not already store, word for word, is refused (`BLOCK_BUILDER_DISABLED`); one already stored can still be moved, duplicated or deleted, so its authors keep their own email.
- **Editor.** The Block Builder opens only with the flag on and `mailing.edit-structure`: composing rewrites the block's markup. As for every structure limit of the writer, the server does not hold that one yet ([ADR 0004](./0004-reviewer-writer-tech-admin-roles.md), until #1103).
- **Refused by default.** A missing flag is off, a capability a role does not list is refused, and a state the server cannot read is refused rather than rebuilt into nothing.

## MCP exposure

Not exposed in this slice. No MCP tool writes an email's content or the block library, and the read tools see a composed block only as part of the email's rendered markup, like any other block. Composing through MCP would need a tool that writes a composition, so the same pipeline, rights and refusals as the editor; it is a separate decision, taken when such a tool is wanted.

## Considered Options

- **One row per block** (the earlier decision, reversed here): keeps a row addressable by Mosaico itself — moved, duplicated, commented on. Rejected because it makes the saved-block library useless for anything but fragments: a reusable structure is several rows by nature.
- **Fluid hybrid layout** (`inline-block` + `max-width`): stacks with no stylesheet at all, so no head-CSS work. Rejected because it brings Outlook ghost tables back for every column, against three builders out of three (Dartagnan, Brevo, and Badsender's own templates) that use real percentage table cells.
- **Columns that shrink instead of stacking**: what the default rendering already does, and what Brevo ships for thumbnails. Kept as the degraded rendering, not as the design.
- **`generate()` returning `{ html, css }`**: rejected. Two of its five callers compare its result to the stored `builderHtml` to detect an altered block; a `collectCss(state)` beside it keeps those comparisons markup-to-markup, and keeps the frozen artifact and the recomputed value from sharing one return value.
- **Writing every composition as `v: 2`**: one shape on disk, but a rollback would then lose every composed block, including the single-column ones the previous version reads perfectly well.

- **A stack spacing written into the stylesheet as typed** (`padding-bottom:13px` from the stored value): any value, no steps. Rejected because the derived stylesheet would then carry a stored value, and keeping it a closed list of the generator's own rules is what lets it skip the gate the author's stylesheet goes through.
- **A gutter as spacer cells between the columns**: no padding to take off the images. Rejected because each spacer is one more cell that has to vanish when the columns stack, and the cell count would no longer be the column count the drag and the stacking rely on.

## Consequences

- **Comment threads are anchored on `blockId`**, so a row inside a composed block cannot carry its own thread: a five-row block is one thread. Accepted for this slice — per-row comments would mean changing the `Comment` model and its index. Duplicating a row becomes an action inside the builder instead.
- **The head-CSS channel refused the composed block on purpose** (`exported-css.js`: _"The HTML code block only, not the builder's"_), on the then-true grounds that the builder wrote everything inline. The derived stylesheet now goes through it, under the rules above; the author's stylesheet keeps its own.
- **The stacking class names what the column does on a phone** (`lp-stack`), as one value among others to come, rather than standing for "the mobile class". Whether a row stacks is not configurable, but it will be: a second behaviour gets a second class beside the first, with no stored block to migrate, and the setting that picks it will live on the row object, as the stack spacing already does.
- **Widths are stored, presets are not.** Presets (1, 2×50, 66/34, 34/66, 33/33/34, 4×25) are shortcuts in the panel that write widths, and each adds up to 100. Storing a preset name beside the widths would be a second source of truth, and the two would drift.
- **Free ratios cost nothing.** A column's desktop width travels in its `width` attribute and inline style, not in a class, so arbitrary ratios emit no extra CSS — the stacking rule is identical for every column whatever its ratio.
