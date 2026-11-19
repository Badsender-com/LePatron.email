# A composed block holds rows of columns, and emits its own stylesheet

- Status: proposed
- Date: 2026-10-08
- Epic: #1194

The Block Builder shipped single-column: a composed block was a flat list of elements, and every style it produced was inline. Columns break both halves of that. A block now holds **rows**, each row holds **columns**, and each column holds elements — because a saved block has to be a whole structure (a one-column title row, then a two-column row with an image facing text and a button) rather than one row that only becomes a layout once several blocks sit next to each other. And because a stacking rule cannot be inlined by definition — it only means anything inside a media query — the generator now derives a stylesheet from the state alongside the markup, recomputed at export and never stored.

## Considered Options

- **One row per block** (the earlier decision, reversed here): keeps a row addressable by Mosaico itself — moved, duplicated, commented on. Rejected because it makes the saved-block library useless for anything but fragments: a reusable structure is several rows by nature.
- **Fluid hybrid layout** (`inline-block` + `max-width`): stacks with no stylesheet at all, so no head-CSS work. Rejected because it brings Outlook ghost tables back for every column, against three builders out of three (Dartagnan, Brevo, and Badsender's own templates) that use real percentage table cells.
- **Columns that shrink instead of stacking**: what the default rendering already does, and what Brevo ships for thumbnails. Kept as the degraded rendering, not as the design.
- **`generate()` returning `{ html, css }`**: rejected. Two of its five callers compare its result to the stored `builderHtml` to detect an altered block; a `collectCss(state)` beside it keeps those comparisons markup-to-markup, and keeps the frozen artifact and the recomputed value from sharing one return value.

## Consequences

- **Comment threads are anchored on `blockId`**, so a row inside a composed block cannot carry its own thread: a five-row block is one thread. Accepted for this slice — per-row comments would mean changing the `Comment` model and its index. Duplicating a row becomes an action inside the builder instead.
- **The head-CSS channel refused the composed block on purpose** (`exported-css.js`: _"The HTML code block only, not the builder's"_), on the then-true grounds that the builder wrote everything inline. Both gates — export and canvas preview — now read "what the export would carry" over both sources. Generated CSS needs no gate of its own: being derived from the model, it cannot exist without a composed block to derive it from.
- **The stacking class is named after the behaviour, not after stacking.** Mobile behaviour is not configurable in this slice, but it will be; a class whose name is a value admits a second value without a migration, and the row object is where that future setting hangs.
- **Widths are stored, layouts are not.** Presets (1, 2×50, 66/33, 33/66, 3×33, 4×25) are shortcuts in the panel that write widths. Storing a `layout` name beside the widths would be a second source of truth, and the two would drift.
- **A stored `v: 1` state reads as one single-column row**, in memory, with nothing rewritten in the database. `parseState` already refuses a state from a higher version than it knows, so a `v: 2` state opened by an older editor is refused rather than emptied.
- **Free ratios cost nothing.** A column's desktop width travels in its `width` attribute and inline style, not in a class, so arbitrary ratios emit no extra CSS — the stacking rule is identical for every column whatever its ratio.
