'use strict';

const {
  fallbackOf,
} = require('../../packages/shared/block-builder/manifest.js');

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
  return `[[${name}|${slot.context}|${fallbackOf(slot)}]]`;
}

// Outlook's conditional comments, in their three spellings:
//
//   <!--[if mso]> … <![endif]-->      one comment, hidden from everyone else
//   <!--[if !mso]><!--> … <!--<![endif]-->   two, around markup the rest see
//
// They are markup to the clients that read them, so they are the only comments
// that ship.
const CONDITIONAL_COMMENT = /^(\[if\s[^\]]*\]>[\s\S]*<!\[endif\]|\[if\s[^\]]*\]><!|<!\[endif\])$/;

/**
 * Drops every comment but Outlook's conditional ones.
 *
 * A comment in a component is a note for whoever edits it next — why the
 * whitespace matters, a `prettier-ignore` — and none of that belongs in the
 * email of every user who ships the block.
 *
 * @param {string} html
 * @returns {string}
 */
function stripComments(html) {
  return html.replace(/<!--([\s\S]*?)-->/g, (comment, inside) =>
    CONDITIONAL_COMMENT.test(inside) ? comment : ''
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
 * The last touches on markup that is otherwise final.
 *
 * @param {string} html
 * @returns {string}
 */
function normaliseMarkup(html) {
  return closeVoidTags(reEncodeEntities(html));
}

/**
 * Swaps every sentinel back for the placeholder the generator understands.
 *
 * A sentinel that comes back altered means the template transformed a prop,
 * and that is a bug in the component, not something to paper over.
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

  // Case-insensitive because the likeliest way to damage a sentinel is a
  // `.toUpperCase()` or a `.toLowerCase()` in the template.
  const stray = new RegExp(`${SENTINEL_PREFIX}[A-Za-z0-9]*`, 'i').exec(out);
  if (stray) {
    throw new Error(
      `${name}: a prop reached the markup altered (${stray[0]}). The ` +
        'template transforms it — a case change, a method call — instead of ' +
        'rendering it as it is; the value is only known at render time, so ' +
        'the transformation cannot happen here.'
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
  stripComments,
  normaliseMarkup,
  substitutePlaceholders,
};
