'use strict';

// The markup a block had before generator 1.1.0, made into the markup it has
// now — for the reference fixtures, which were produced before
// (flat-render-reference.json) and are data: nothing rewrites them.
//
// Two differences, and only these:
//   - the block's outer table is 600px wide, centred, never wider than what
//     holds it (atBlockWidth). Everything inside it is the byte-for-byte
//     markup it always was;
//   - a blank element is not sent (isBlankElement): a block holding nothing
//     else renders nothing at all (renderedNow).
// Not a test file — no `.test.js`.

const {
  isBlankElement,
} = require('../../../packages/shared/block-builder/element-markup.js');

const OUTER = /^<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="([^"]*)" style="background-color:([^"]*);">/;

/**
 * @param {string} html a block's markup, as the generator wrote it before
 * @returns {string} the same block, held to its width
 */
function atBlockWidth(html) {
  if (html === '') return html;
  if (!OUTER.test(html)) {
    throw new Error('atBlockWidth: not the outer table of a block');
  }
  return html.replace(
    OUTER,
    (_match, bgcolor, background) =>
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"' +
      ` width="600" align="center" bgcolor="${bgcolor}"` +
      ` style="width:600px;max-width:100%;background-color:${background};">`
  );
}

/**
 * What a reference fixture renders as now: nothing when every element is
 * blank and drawn as no starter, its markup held to its width otherwise.
 *
 * @param {{state: string, html: string, options: (Object|undefined)}} fixture
 * @returns {string}
 */
function renderedNow(fixture) {
  const starters = (fixture.options && fixture.options.starters) || {};
  const { elements } = JSON.parse(fixture.state);
  const sendsNothing = elements.every(
    (element) => isBlankElement(element) && !starters[element.type]
  );
  return sendsNothing ? '' : atBlockWidth(fixture.html);
}

module.exports = { atBlockWidth, renderedNow };
