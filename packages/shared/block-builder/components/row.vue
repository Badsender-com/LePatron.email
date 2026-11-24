<script setup>
// One row of a composed block — the table its column cells sit side by side in.
//
// A layout, like column.vue: it holds no value a user typed, only the cells the
// generator already rendered (see ../rows.js). Written here rather than as a
// string in the generator so the row goes through the same compiler checks as
// every other piece of markup that ships.
//
// The `prettier-ignore` keeps `<tr>{{ cells }}</tr>` on one line: whitespace
// around the cells would land between them, and Vue keeps it.
//
// See README.md, next to this file, for the rules every component here obeys.
defineProps({
  cells: String,
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
    <!-- prettier-ignore -->
    <tr>{{ cells }}</tr>
  </table>
</template>
