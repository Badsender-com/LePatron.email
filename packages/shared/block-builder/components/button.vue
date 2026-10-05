<script setup>
// Call to action.
//
// NO VML, on purpose, and it is the one debatable decision in this file.
//
// Forcing rounded corners on Outlook means a `v:roundrect`, and a `v:roundrect`
// needs its width in pixels — which locks the label. The Badsender design rules
// say it outright: "for translated, automated or heavily industrialised emails,
// prefer a button whose degradation to square corners is accepted over a locked
// label". A builder is industrialisation by definition, and a label the user
// retypes is the normal case here, so the button degrades to square corners on
// Outlook and keeps its width from its content everywhere.
//
// The rest is the bulletproof shape: background on the cell AND on the anchor,
// because Outlook paints the cell while the rest paint the padded inline-block;
// `bgcolor` next to the CSS for the clients that still read the attribute.
//
// Tap target: the default vertical padding plus the line height clears 44px, the
// minimum the design rules ask for.
//
// What every component here may and may not do — and why — is in README.md,
// next to this file.
//
// Note on `text-decoration`: stock Tailwind 3's `no-underline` emits
// `text-decoration-line: none`, a longhand the older Outlook builds ignore.
// The email config (scripts/block-builder/tailwind.config.js) redefines it as
// the shorthand and the build refuses the longhand, but this one predates that
// and is written inline either way. On primitives this low, Tailwind earns its
// place one utility at a time.
defineProps({
  label: String,
  href: String,
  align: String,
  backgroundColor: String,
  color: String,
  borderRadius: String,
  fontFamily: String,
  fontSize: String,
  lineHeight: String,
  verticalPadding: String,
  horizontalPadding: String,
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
        :align="align"
        :style="`padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;`"
      >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td
              align="center"
              :bgcolor="backgroundColor"
              :style="`background-color:${backgroundColor}; border-radius:${borderRadius}px;`"
            >
              <a
                :href="href"
                target="_blank"
                class="inline-block"
                :style="`padding:${verticalPadding}px ${horizontalPadding}px; font-family:${fontFamily}; font-size:${fontSize}px; line-height:${lineHeight}px; color:${color}; text-decoration:none; border-radius:${borderRadius}px; mso-line-height-rule:exactly;`"
                >{{ label }}</a
              >
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</template>
