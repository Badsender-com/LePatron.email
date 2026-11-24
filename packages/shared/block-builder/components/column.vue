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
// `content` is the one slot in this package that is not escaped: it holds
// markup the GENERATOR built. See slot-contexts.js, and note the `kind` in the
// manifest beside this file — an element may not declare that context.
//
// See README.md, next to this file, for the rules every component here obeys.
defineProps({
  width: String,
  content: String,
  // The class that makes this cell stack on a phone. Only rendered by the
  // variants that stack.
  stackClass: String,
  // Fixed at compile time by the variant, never a stored value.
  filled: Boolean,
  stacks: Boolean,
});
</script>

<template>
  <td
    v-if="filled && stacks"
    :width="width"
    :class="stackClass"
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
    v-else-if="stacks"
    :width="width"
    :class="stackClass"
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
