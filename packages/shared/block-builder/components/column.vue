<script setup>
// One column of a row — a real table cell.
//
// A cell, not a `div` in `inline-block`: that is what lets Outlook lay the
// columns out natively, with no ghost table anywhere. It is also what three
// builders out of three do, and what Badsender's own templates do for their
// multi-column modules.
//
// Its width twice: in the `width` attribute, which Outlook on Windows reads,
// and in the style, which every other client reads. The style is always a
// percentage of the block, so the row shrinks with a narrower window. The
// attribute is the same percentage when the row's widths are all whole ones,
// and the cell's width in px when they are not: a percentage there would need
// decimals, and an attribute is where Outlook rounds. The generator decides
// per row (row-markup.js), so a row never mixes the two.
//
// `valign="top"` because the default is middle, and two columns of unequal
// height would otherwise float their content against each other's centre.
//
// The `v-if` on `filled` is the kind this codebase allows: it tests a prop the
// MANIFEST fixes, never a value a user types. An empty column keeps its cell —
// the layout would collapse without it — but an empty `<td>` retracts in
// several clients, taking the width with it. A zero-sized non-breaking space
// holds it open without drawing a line.
//
// `stacks` picks between a cell that carries the stacking class and one with
// no `class` attribute at all: a row of one column has nothing to stack, and an
// empty `class=""` would ship in every email for nothing.
//
// `padded` is a cell with a gutter before it: the gutter is the cell's
// `padding-left`, inline, which Outlook on Windows lays out natively, and the
// cell's width counts it. Its own variants for the same reason as `stacks`: a
// cell with no gutter before it ships no padding declaration at all. Only a
// row of several columns has gutters, so only a stacking cell is ever padded.
//
// `content` is the one slot in this package that is not escaped: it holds
// markup the GENERATOR built. See slot-contexts.js, and note the `kind` in the
// manifest beside this file — an element may not declare that context.
//
// See README.md, next to this file, for the rules every component here obeys.
defineProps({
  // The cell's width as a percentage of the block, for the style.
  width: String,
  // The same width for the attribute: the percentage, or px.
  widthAttribute: String,
  content: String,
  // The classes that say what this cell does on a phone: it stacks, and may
  // drop its gutter or keep a space under it. Only rendered by the variants
  // that stack.
  classes: String,
  // The gutter before the cell, in px.
  gutter: String,
  // Fixed at compile time by the variant, never a stored value.
  filled: Boolean,
  stacks: Boolean,
  padded: Boolean,
});
</script>

<template>
  <td
    v-if="filled && padded"
    :width="widthAttribute"
    :class="classes"
    valign="top"
    :style="`width:${width}; padding-left:${gutter}px;`"
  >
    {{ content }}
  </td>
  <td
    v-else-if="filled && stacks"
    :width="widthAttribute"
    :class="classes"
    valign="top"
    :style="`width:${width};`"
  >
    {{ content }}
  </td>
  <td
    v-else-if="filled"
    :width="widthAttribute"
    valign="top"
    :style="`width:${width};`"
  >
    {{ content }}
  </td>
  <!-- prettier-ignore -->
  <td
    v-else-if="padded"
    :width="widthAttribute"
    :class="classes"
    valign="top"
    :style="`width:${width}; padding-left:${gutter}px; font-size:0; line-height:0;`"
  >&nbsp;</td>
  <!-- prettier-ignore -->
  <td
    v-else-if="stacks"
    :width="widthAttribute"
    :class="classes"
    valign="top"
    :style="`width:${width}; font-size:0; line-height:0;`"
  >&nbsp;</td>
  <!-- prettier-ignore -->
  <td
    v-else
    :width="widthAttribute"
    valign="top"
    :style="`width:${width}; font-size:0; line-height:0;`"
  >&nbsp;</td>
</template>
