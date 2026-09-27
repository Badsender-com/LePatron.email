<script setup>
// Text element.
//
// The markup follows what the Badsender templates already ship: a
// `role="presentation"` table with the three zeroed attributes, padding on the
// cell rather than margins on the paragraph, and the font stack repeated inline
// because most clients drop what is not on the element itself.
//
// `content` is RICH_TEXT: bold, italic, underline, links and line breaks pass
// through, everything else is dropped. That is an allow-list rebuild, not an
// escape — see rich-text.js. It is also why the interpolation is `v-html` and
// not `{{ }}`: the sentinel must land as markup, so that what replaces it at
// render time can be markup too. Nothing unsafe follows from that — the value
// the generator puts there has been through the rebuilder.
//
// See button.vue for the rules every component here obeys.
defineProps({
  content: String,
  align: String,
  fontFamily: String,
  fontSize: String,
  lineHeight: String,
  paddingTop: String,
  paddingRight: String,
  paddingBottom: String,
  paddingLeft: String,
  color: String,
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
        :align="align"
        :style="`padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px; font-family:${fontFamily}; font-size:${fontSize}px; line-height:${lineHeight}px; color:${color}; mso-line-height-rule:exactly;`"
        v-html="content"
      ></td>
    </tr>
  </table>
</template>
