# A composed block holds rows of columns, and emits its own stylesheet

- Status: proposed
- Date: 2026-10-08
- Epic: #1194

The Block Builder shipped single-column: a composed block was a flat list of elements, and every style it produced was inline. Columns break both halves of that. A block now holds **rows**, each row holds **columns**, and each column holds elements — because a saved block has to be a whole structure (a one-column title row, then a two-column row with an image facing text and a button) rather than one row that only becomes a layout once several blocks sit next to each other. And because a stacking rule cannot be inlined by definition — it only means anything inside a media query — the generator now derives a stylesheet from the state alongside the markup, recomputed at export and never stored.

## Stored shape

- **In memory, a composition is always made of rows.** Every reader, the modal and the generator included, works on rows; there is no flat view beside them.
- **On disk, the version number says the shape.** A composition of one row holding one column, with no row setting, is written `{ v: 1, elements }`. Any other composition is written `{ v: 2, rows }`.
- **Rendering follows the same rule.** A composition that would be written `v: 1` renders flat, as it did before columns: the elements' own tables, with no table of column cells around them. Anything else renders as rows of table cells (see "Row layout" for their widths). So a block stored in `v: 1` reads as one row of one column, renders identically, and is written back identically.
- **The server keeps `builderState` as it was sent.** It reads the state to rebuild the markup, and checks that it can be read, but it never normalises the stored string: what the author's editor wrote is what the next editor reads, and the one copy that has to match the generator, the markup, is the one the server regenerates.

A rollback to a version without columns only loses the blocks that use the new structure: several columns, or several rows. A block of one row and one column is still `v: 1`, which that version reads. A `v: 2` block is unreadable there: the older editor offers to replace it with an empty block, and applying that loses the composition. That cost is accepted, and kept to the blocks that could not be written any other way.

## Bounds

- **More than 50 rows (`MAX_ROWS`): the composition is refused, not folded.** `parseState` returns `null`, and the server answers `BLOCK_BUILDER_STATE_UNREADABLE`. Refuse rather than lose: folding the extra rows into the last one would rewrite a composition nobody asked to change, and the next save would store the rewrite. A refusal leaves the stored block as it was and tells the author.
- **An entry of `rows` that is not an object is ignored.** It holds nothing to keep.
- **More than four columns (`MAX_COLUMNS`) in a row: the extra columns are folded into the fourth.** Their elements are appended to it, in order, and the widths are recomputed: kept when the four still fill the block with the gutters and no column under 60 px, equal shares otherwise, the remainder going to the last column. A layout nobody can see any more is a visible problem; a paragraph that silently disappeared is not.

## Row layout: widths in px, a gutter per interval

A row of several columns lays out the 600 px of the block (`BLOCK_WIDTH`) as column, gutter, column… (#1683). The first version of this slice had one gutter per row, split in halves on either side of each interval; it left a middle column a whole gutter narrower than an outer one, so a grid of four images no longer lined up. It is replaced by this.

- **Stored shape.** Each column's `width` is the width of its **content**, in whole px, never under 60 (`MIN_COLUMN_WIDTH`, a tenth of the block). The row holds `gutters`, one per interval, each 0 to 40 px; the key is written only when one of them is not 0. Columns and gutters together fill the block. Two columns given the same width hold content of the same width, whatever gutters surround them, and an image is told exactly that width (`fitWidth`): the question of which column gives up the room for a gutter does not exist.
- **Read normalised** (`row-layout.js`, `row-spacing.js`): gutters made whole px within the bounds, a value that is not a number dropped; widths kept when they fill the block between the gutters, equal shares of what the gutters leave otherwise. **Widths in percent**, as this slice wrote them before px (whole numbers, adding up to 100, none under 10), are read as px of the block, so a composition saved on a test instance reopens as it was. Columns never went to production: there is no migration, and the next save writes px.
- **A row of one column stays flat**: it holds no gutter and no stack spacing, and a full width is recognised in either unit, so `flatRowOf` treats it as before. A row that goes down to one column loses both settings.
- **Presets are proportions** of what the gutters leave, rounded to the pixel with the remainder on the last column; applying one keeps the row's gutters between the columns that remain.
- **Stack spacing (mobile)**: `stackSpacing`, the vertical space between the columns once they stack on a phone, 0 to 40 px **to the pixel**, independent of the gutters. On a phone the gutters do not apply: the stacked columns take the full width.

**Rendering.** A cell is its column plus the gutter before it, and that gutter is the cell's inline `padding-left`: padding on a table cell is what Outlook on Windows lays out natively, the first cell has none, and no cell has any on its right. The cell's width is given twice, as everywhere in the generator: the style holds its share of the block in percent, up to four decimals, so the row still shrinks with a narrower window; the `width` attribute, which Outlook reads, holds the same percentage when every cell of the row is a whole one, and the cell's px when one is not. A percentage with decimals is where Outlook would round, and px in the attribute are exact in a 600 px template; keeping the percentage whenever it is whole keeps the markup of every preset row with no gutter exactly as it was. The choice is made per row, so a row never mixes the two.

**The mobile half stays a closed list.** The derived stylesheet holds only rules the generator owns, from a list it fixes, never a stored value. So the stack spacing does not write its value into a rule: it picks a generated class, one per pixel (`lp-stack-spacing-1` … `lp-stack-spacing-40`), carried by a stacked column that holds something and has another one holding something after it — an empty column takes no room once stacked, and must neither leave a blank band nor double the space. A cell with a gutter before it carries `lp-gutter`, which drops its side padding on a phone. The list holds forty names, but a stylesheet only holds the rules its composition uses: a mailing whose rows are spaced alike carries one spacing rule, whatever the value. The first version went by steps of 4 px, ten classes, and rounded what was typed; an author who typed 13 saw 12 and had to read a note to know why. A value typed to the pixel is now kept, a fraction made a whole pixel.

**The classes are decided per cell**, one list per cell joined only in the slot, by one function (`rowClasses` in `row-markup.js`) that both the markup and the stylesheet ask.

**Setting it.** Under the presets, the panel draws the block as a bar of columns and gutters. Between two pieces, a handle: a slider for the keyboard (arrows 1 px, Shift 10 px), dragged with the pointer otherwise, it widens the piece on its left at the expense of its right neighbour, so the total stays 600. A number field per piece sets it to the pixel, the next column giving the room, so typing a column's width never eats the gutter beside it. A zero gutter keeps a few pixels on the bar so both its handles can be grabbed, and a drag that starts on two handles at one spot opens the gutter when it goes right.

## Generator 1.1.0: the block's width, and blank elements

Two changes to what every composed block renders, so the generator goes from 1.0.0 to 1.1.0: a block written before is rebuilt when it is reapplied, and the modal says so on reopening (`rebuildsMarkup`). The markup of a block nobody reopens stays as it was stored.

- **The block holds to the width it is laid out for.** Its outer table is `width="600" align="center"`, styled `width:600px;max-width:100%`; it was 100% wide. A template's block slot can be wider than its content (800 px, each native block centring its own 600 px table): the block spread over the whole slot, its halves became 400 px wide, and it lined up with nothing around it. The attribute is what Outlook on Windows reads, the `max-width` lets every other client shrink it to a phone. Nothing inside the outer table changes. The block's background stays on that table, so it covers the 600 px of the block, as the modal shows it, not the template's whole slot.
- **A blank element is not sent.** Each element's manifest declares the slot that makes it something (`required`: a text's words, an image's source, a button's label). Blank in that slot, the element renders nothing outside the preview, where it is still drawn as its starter, there to be filled; the element list marks it « vide » and a status under the preview counts them. A column holding only blank elements is an empty column, for the markup and the stylesheet alike, and a block holding nothing else renders nothing. Considered: giving new elements real default words, which then ship unnoticed in a client's email, and refusing to apply a block with a blank element, which blocks an author who means to fill it later. A blank element stays in the state, so nothing the author placed is lost.

The reference markup produced before columns (`flat-render-reference.json`) is not rewritten: its tests apply these two changes to it, and nothing else.

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

- **One gutter per row, half on each side of every interval**: the first version of this slice. Rejected once built: a middle column loses a whole gutter, an outer one half, so equal columns hold unequal images.
- **Widths kept in whole percentages**: one step is 6 px, and a gutter of a few pixels cannot be balanced against them. Replaced by px, possible without a migration since columns had not shipped.
- **Percentages with decimals in the `width` attribute**: one rule for every row, but the attribute is what Outlook reads, and where it would round.
- **A stack spacing written into the stylesheet as typed** (`padding-bottom:13px` from the stored value): any value, no list. Rejected because the derived stylesheet would then carry a stored value, and keeping it a closed list of the generator's own rules is what lets it skip the gate the author's stylesheet goes through.
- **A gutter as spacer cells between the columns**: no padding to take off the images. Rejected because each spacer is one more cell that has to vanish when the columns stack, and the cell count would no longer be the column count the drag and the stacking rely on.

## Consequences

- **Comment threads are anchored on `blockId`**, so a row inside a composed block cannot carry its own thread: a five-row block is one thread. Accepted for this slice — per-row comments would mean changing the `Comment` model and its index. Duplicating a row becomes an action inside the builder instead.
- **The head-CSS channel refused the composed block on purpose** (`exported-css.js`: _"The HTML code block only, not the builder's"_), on the then-true grounds that the builder wrote everything inline. The derived stylesheet now goes through it, under the rules above; the author's stylesheet keeps its own.
- **The stacking class names what the column does on a phone** (`lp-stack`), as one value among others to come, rather than standing for "the mobile class". Whether a row stacks is not configurable, but it will be: a second behaviour gets a second class beside the first, with no stored block to migrate, and the setting that picks it will live on the row object, as the stack spacing already does.
- **Widths are stored, presets are not.** Presets (1, 2×50, 66/34, 34/66, 33/33/34, 4×25) are shortcuts in the panel that write widths in px from proportions adding up to 100. Storing a preset name beside the widths would be a second source of truth, and the two would drift.
- **Free ratios cost nothing.** A column's desktop width travels in its `width` attribute and inline style, not in a class, so arbitrary ratios emit no extra CSS — the stacking rule is identical for every column whatever its ratio.
