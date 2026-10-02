<script setup>
// Image element.
//
// `display:block` kills the baseline gap clients leave under an inline image;
// `width` as an attribute AND in the style because Outlook reads the attribute
// and everything else reads the style; `max-width` plus `width:100%` so the
// image shrinks with its column instead of overflowing it.
//
// The `v-if` on `linked` is the one kind this codebase allows: it tests a prop
// the MANIFEST fixes, not a value the user types. The compiler renders the
// component once per variant with that prop set, so the branch is gone by the
// time the generator sees it — which it has to be, because the generator joins
// strings and never branches. An image with no link must not ship an empty
// `<a>`, which some clients render as a focusable, underlined gap.
//
// See button.vue for the rest of the rules.
defineProps({
  src: String,
  alt: String,
  href: String,
  width: String,
  align: String,
  paddingTop: String,
  paddingRight: String,
  paddingBottom: String,
  paddingLeft: String,
  // Fixed at compile time by the variant, never a stored value.
  linked: Boolean,
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
        :style="`padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;`"
      >
        <a
          v-if="linked"
          :href="href"
          target="_blank"
          style="text-decoration: none"
          ><img
            :src="src"
            :alt="alt"
            :width="width"
            :style="`display:block; border:none; outline:none; text-decoration:none; width:100%; max-width:${width}px; height:auto;`"
        /></a>
        <img
          v-else
          :src="src"
          :alt="alt"
          :width="width"
          :style="`display:block; border:none; outline:none; text-decoration:none; width:100%; max-width:${width}px; height:auto;`"
        />
      </td>
    </tr>
  </table>
</template>
