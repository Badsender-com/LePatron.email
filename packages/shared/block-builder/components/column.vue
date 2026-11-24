<script setup>
// One column of a row — a real table cell carrying a percentage width.
//
// A cell, not a `div` in `inline-block`: that is what lets Outlook lay the
// columns out natively, with no ghost table anywhere. It is also what three
// builders out of three do, and what Badsender's own templates do for their
// multi-column modules.
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
// `padded` is a cell of a row with a gutter: the gutter is padding on the
// cell, inline, which Outlook on Windows lays out natively. Its own variants
// for the same reason as `stacks`: a row without a gutter ships no padding
// declaration at all, and renders exactly as it did before gutters existed.
// Only a row of several columns has a gutter, so only a stacking cell is ever
// padded.
//
// `content` is the one slot in this package that is not escaped: it holds
// markup the GENERATOR built. See slot-contexts.js, and note the `kind` in the
// manifest beside this file — an element may not declare that context.
//
// See README.md, next to this file, for the rules every component here obeys.
defineProps({
  width: String,
  content: String,
  // The classes that say what this cell does on a phone: it stacks, and may
  // drop its gutter or keep a space under it. Only rendered by the variants
  // that stack.
  classes: String,
  // The cell's half of the gutter on each side, in px: 0 on an outer edge.
  gutterLeft: String,
  gutterRight: String,
  // Fixed at compile time by the variant, never a stored value.
  filled: Boolean,
  stacks: Boolean,
  padded: Boolean,
});
</script>

<template>
  <td
    v-if="filled && padded"
    :width="width"
    :class="classes"
    valign="top"
    :style="`width:${width}; padding-left:${gutterLeft}px; padding-right:${gutterRight}px;`"
  >
    {{ content }}
  </td>
  <td
    v-else-if="filled && stacks"
    :width="width"
    :class="classes"
    valign="top"
    :style="`width:${width};`"
  >
    {{ content }}
  </td>
  <td v-else-if="filled" :width="width" valign="top" :style="`width:${width};`">
    {{ content }}
  </td>
  <!-- prettier-ignore -->
  <td
    v-else-if="padded"
    :width="width"
    :class="classes"
    valign="top"
    :style="`width:${width}; padding-left:${gutterLeft}px; padding-right:${gutterRight}px; font-size:0; line-height:0;`"
  >&nbsp;</td>
  <!-- prettier-ignore -->
  <td
    v-else-if="stacks"
    :width="width"
    :class="classes"
    valign="top"
    :style="`width:${width}; font-size:0; line-height:0;`"
  >&nbsp;</td>
  <!-- prettier-ignore -->
  <td
    v-else
    :width="width"
    valign="top"
    :style="`width:${width}; font-size:0; line-height:0;`"
  >&nbsp;</td>
</template>
