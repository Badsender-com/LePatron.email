'use strict';

// How the canvas previews media queries in each preview mode. Shared by the
// template's own stylesheet (badsender-screen-preview.js) and the head CSS
// (head-css/canvas-preview.js), so both follow the same rules.
//
// The canvas is a div of the editor's document, so a media query is evaluated
// against the browser window, never against the canvas width: shrinking the
// canvas to 350px triggers no mobile rule on its own. The condition is
// replaced by one that always holds instead:
//
//   - `mobile`: forced, so the mobile rules show;
//   - `both`, the default: forced too, but every selector inside gets the
//     `.visible-on-both` suffix. Nothing in the editor carries that class, so
//     in practice the mobile rules do NOT show in this mode;
//   - any other mode (`desktop`, `large`): the author's condition, as written.
//
// EVERY media query is forced, not only the `max-width` ones: a desktop-only
// `min-width` query applies too. Blunt, but it is how the template behaves.
//
// The block builder's own preview forces the same way, through forceMedia, in
// its Mobile view: its iframe is 600px wide on Desktop, exactly the breakpoint,
// so a condition evaluated there would hold in both views. One rewrite for
// both previews, so the modal and the canvas cannot drift on what a forced
// stylesheet is.

const cssParse = require('mensch/lib/parser.js');
const cssStringify = require('mensch/lib/stringify.js');

const ALWAYS_TRUE_MEDIA = 'only screen and (min-width: 0px)';
const VISIBLE_ON_BOTH_SUFFIX = '.visible-on-both';

// At-rules that can hold a media query, as scope-css.js descends into them.
const NESTING_AT_RULES = new Set(['media', 'supports', 'document']);

/**
 * @param {string} [mode] the editor's `previewMode`
 * @returns {{ forceMedia: boolean, mediaSelectorSuffix: string }}
 */
function previewMediaFor(mode) {
  return {
    forceMedia: mode === 'mobile' || mode === 'both',
    mediaSelectorSuffix: mode === 'both' ? VISIBLE_ON_BOTH_SUFFIX : '',
  };
}

/**
 * Replaces the condition of every media query, at any depth, by one that
 * always holds. In place.
 *
 * @param {Array} rules mensch AST nodes
 * @returns {Array} the same rules
 */
function forceMediaRules(rules) {
  if (!Array.isArray(rules)) return rules;
  rules.forEach((rule) => {
    if (!rule || !NESTING_AT_RULES.has(rule.type)) return;
    if (rule.type === 'media') rule.name = ALWAYS_TRUE_MEDIA;
    forceMediaRules(rule.rules);
  });
  return rules;
}

/**
 * A stylesheet with every media query forced, everything else as written.
 *
 * @param {string} css
 * @returns {string} the forced stylesheet, '' for an empty one or one that
 *   cannot be parsed — nothing applied rather than something wrong
 */
function forceMedia(css) {
  if (typeof css !== 'string' || css.trim() === '') return '';
  try {
    const sheet = cssParse(css, { comments: true });
    if (!sheet || !sheet.stylesheet) return '';
    forceMediaRules(sheet.stylesheet.rules);
    return cssStringify(sheet, { indentation: '' });
  } catch (error) {
    return '';
  }
}

module.exports = {
  ALWAYS_TRUE_MEDIA,
  VISIBLE_ON_BOTH_SUFFIX,
  previewMediaFor,
  forceMedia,
  forceMediaRules,
};
