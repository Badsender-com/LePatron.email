<script setup>
// Horizontal rule.
//
// A bordered cell rather than an `<hr>`: clients style `<hr>` inconsistently and
// several ignore its colour entirely. The border sits on a zero-height cell, so
// the line is exactly the thickness asked for, and `font-size:0; line-height:0`
// stops the `&nbsp;` from giving that cell a line box of its own.
//
// See button.vue for the rules every component here obeys.
defineProps({
  color: String,
  thickness: String,
  width: String,
  paddingTop: String,
  paddingRight: String,
  paddingBottom: String,
  paddingLeft: String,
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
      <td
        :style="`padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;`"
      >
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          :width="width"
          align="center"
        >
          <tr>
            <!-- The whitespace around &nbsp; is significant: Vue keeps it, and it
                 would land in every email that ships this block. -->
            <!-- prettier-ignore -->
            <td
              :style="`border-top:${thickness}px solid ${color}; font-size:0; line-height:0;`"
            >&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</template>
