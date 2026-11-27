'use strict';

// The markup a block had before it held to the width it is laid out for, made
// into the markup it has now — for the reference fixtures, which were produced
// before (flat-render-reference.json) and are data: nothing rewrites them.
//
// The one difference is on the block's outer table, and only there: 600px
// wide, centred, never wider than what holds it. Everything inside it is the
// byte-for-byte markup it always was. Not a test file — no `.test.js`.

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

module.exports = { atBlockWidth };
