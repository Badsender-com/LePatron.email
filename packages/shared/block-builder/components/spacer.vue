<script setup>
// Vertical spacer.
//
// A cell with an explicit height, plus `font-size:0` and `line-height:0`: without
// those, Outlook gives the non-breaking space a line box of its own and the gap
// comes out taller than asked. The `&nbsp;` itself is what stops clients from
// collapsing an empty cell altogether, and `aria-hidden` keeps it out of the
// reading order since it carries nothing.
//
// The height is written twice on purpose — Outlook reads the attribute, the
// rest read the style.
//
// The `prettier-ignore` in the template guards the cell's `>&nbsp;</td>`: the
// whitespace prettier would put around the `&nbsp;` is significant, Vue keeps
// it, and it would land in every email that ships this block. (Template
// comments never ship — the compiler strips them — so the note lives here.)
//
// See button.vue for the rules every component here obeys.
defineProps({
  height: String,
});
</script>

<template>
  <table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
    width="100%"
  >
    <tr>
      <!-- prettier-ignore -->
      <td
        :height="height"
        :style="`height:${height}px; font-size:0; line-height:0;`"
        aria-hidden="true"
      >&nbsp;</td>
    </tr>
  </table>
</template>
