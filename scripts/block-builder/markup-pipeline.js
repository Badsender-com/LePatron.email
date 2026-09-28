'use strict';

const postcss = require('postcss');
const tailwind = require('tailwindcss');
const juice = require('juice');

// Everything that happens to the markup between Vue and the committed file.
//
// Split out of the compiler because that script was past the three hundred
// lines this repository allows (AGENTS.md), and because these two jobs are
// genuinely different: the script decides WHICH components to build and reads
// them off disk, this decides what their HTML has to look like when it lands.
//
// Pure string in, string out — no filesystem, no Vue, no component knowledge
// beyond the slot manifest it is handed.

// Sentinels stand in for every prop while the component renders.
//
// Letters and digits only, and nothing that looks like markup: Vue escapes
// interpolations, Tailwind rewrites class attributes and juice rewrites style
// attributes, and a sentinel has to come out the other end byte for byte. The
// same reasoning, and the same shape, as the export substitution markers in
// packages/editor/src/js/ext/html-code-block/export-substitution.js.
const SENTINEL_PREFIX = 'LPSLOT';

const sentinelFor = (name) =>
  `${SENTINEL_PREFIX}${name.replace(/[^a-zA-Z0-9]/g, '')}X${name.length}`;

/**
 * The `[[name|CONTEXT|fallback]]` placeholder a slot compiles to.
 *
 * @param {string} name
 * @param {Object} slot its manifest entry
 * @returns {string}
 */
function placeholderFor(name, slot) {
  const fallback = slot.fallback === undefined ? '' : String(slot.fallback);
  return `[[${name}|${slot.context}|${fallback}]]`;
}

/**
 * Resolves the Tailwind classes the markup uses and inlines them.
 *
 * Inlined rather than left as classes because the block travels into other
 * people's templates: it can rely on no stylesheet but its own. Responsive
 * classes cannot survive this — they need a media query in the document head —
 * which is why the components are forbidden from using them for now.
 */
async function inlineStyles(html) {
  const { css } = await postcss([
    tailwind({
      content: [{ raw: html, extension: 'html' }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined });

  const inlined = juice.inlineContent(html, css, { removeStyleTags: true });

  // juice folds the rules into `style` but leaves the class names behind, and
  // a class nothing defines is dead weight in every email that ships. They are
  // stripped here — which is only safe because responsive classes are
  // forbidden, so nothing needs a class to survive.
  const responsive = /class="[^"]*\b[a-z]+:[a-z-]/.exec(inlined);
  if (responsive) {
    throw new Error(
      'a responsive class survived inlining: ' +
        `${responsive[0]}…\nThose need a media query in the document head, and ` +
        'that channel is not wired to the generator yet.'
    );
  }

  return closeVoidTags(
    reEncodeEntities(inlined.replace(/\s+class="[^"]*"/g, ''))
  );
}

/**
 * Puts back the entities Vue decoded on its way through.
 *
 * `&nbsp;` in a template becomes a raw U+00A0 in the render, and the raw
 * character is not the same thing downstream: the export pipeline encodes
 * non-ASCII to numeric entities, so what a recipient receives would depend on
 * which path produced it. The spacer and the divider both rely on that
 * character keeping a cell from collapsing, so it is written back explicitly
 * rather than left to whatever runs next.
 */
function reEncodeEntities(html) {
  return html.replace(/\u00a0/g, '&nbsp;');
}

// Void elements, as HTML5 spells them.
const VOID_TAG = /<(img|br|hr|input|meta|link|area|base|col|source|track|wbr)\b([^>]*?)\s*\/?>/gi;

/**
 * Closes void tags the XHTML way.
 *
 * Vue's SSR emits `<img …>`, which is right for HTML5 and wrong for the
 * document these fragments land in: the export declares an XHTML transitional
 * doctype, as email templates generally do. Every client parses either, so this
 * is not a rendering fix — it keeps the generated markup consistent with the
 * document that carries it, and with what the hand-written templates emitted
 * before they were converted.
 */
function closeVoidTags(html) {
  return html.replace(VOID_TAG, (match, tag, attrs) => `<${tag}${attrs} />`);
}

/**
 * Swaps every sentinel back for the placeholder the generator understands.
 *
 * A sentinel that did not come back means the render swallowed it — a `v-if`
 * that hid the element, a prop that was never used — and that is a bug in the
 * component, not something to paper over.
 */
function substitutePlaceholders(html, slots, name) {
  let out = html;
  const used = [];

  Object.entries(slots).forEach(([slotName, slot]) => {
    const sentinel = sentinelFor(slotName);
    if (!out.includes(sentinel)) return;
    used.push(slotName);
    out = out.split(sentinel).join(placeholderFor(slotName, slot));
  });

  const stray = new RegExp(`${SENTINEL_PREFIX}[A-Za-z0-9]*`).exec(out);
  if (stray) {
    throw new Error(
      `${name}.vue: a sentinel survived compilation (${stray[0]}). ` +
        'A prop is rendered that no slot declares.'
    );
  }

  // A slot missing from THIS variant is normal — an image with no link does
  // not render an `href`. A slot missing from EVERY variant is a dead entry in
  // the manifest, and that is checked once all of them are compiled.
  return { html: out, used };
}

module.exports = {
  SENTINEL_PREFIX,
  sentinelFor,
  placeholderFor,
  inlineStyles,
  substitutePlaceholders,
};
