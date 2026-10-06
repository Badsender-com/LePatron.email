'use strict';

const { BLOCK_BUILDER_BLOCK } = require('../../shared/synthetic-blocks.js');
const { findHtmlCodeBlockRanges } = require('./synthetic-block-protection.js');
const logger = require('../utils/logger.js');

// Putting a rebuilt composed block back into previewHtml.
//
// Its own file rather than sitting with the extraction and the injection,
// because it answers a different question: those decide what a block SAYS, this
// decides how the stored preview document is edited. It touches no state, no
// generator and no element — a string and two lists of markup go in, a string
// comes out, with the number of blocks it could not place.

/**
 * Swaps each changed composed block's markup for its rebuilt one, in
 * previewHtml.
 *
 * The preview is translated by replacing strings in the stored document, and
 * a composed block's markup is deliberately PROTECTED from that pass — it is
 * generated, and letting a string replacement loose inside it would corrupt
 * markup nobody typed. So the only way the preview changes language is by
 * having those zones replaced wholesale, which is what this does.
 *
 * Anchored on the zones the protection itself located, not on a search for the
 * old markup: a search over the whole document found a copy of a composed
 * block pasted into an HTML code block before the block itself, and rewrote
 * the copy. Only the CONTENT of a zone whose marker is the builder's, and that
 * was matched exactly on a block whose markup changed, is replaced — the
 * marker element and everything around it stay as they are. A changed block
 * whose zone cannot be found is left alone: a preview that keeps one block in
 * the old language is a visible, recoverable problem, and rewriting the wrong
 * range would not be. It is counted, so the user can be told to check it.
 *
 * @param {string} html previewHtml, already translated everywhere else
 * @param {string[]} before every synthetic block's markup as stored before
 *   translation, in document order — the list the protection matched on
 * @param {string[]} after the same blocks' markup after translation
 * @returns {{ html: string, missed: number }} `missed` counts the changed
 *   blocks whose zone was not found, and so still show the old markup
 */
function swapBuilderMarkup(html, before, after) {
  if (!html || typeof html !== 'string') return { html, missed: 0 };

  const stored = before || [];
  const rebuilt = after || [];
  const changed = new Set(
    stored
      .map((_, index) => index)
      .filter(
        (index) =>
          typeof rebuilt[index] === 'string' && rebuilt[index] !== stored[index]
      )
  );
  if (changed.size === 0) return { html, missed: 0 };

  const zones = findHtmlCodeBlockRanges(html, stored).filter(
    (zone) =>
      zone.markerClass === BLOCK_BUILDER_BLOCK.markerClass &&
      changed.has(zone.matched)
  );

  // Zones come in document order and never overlap.
  let out = '';
  let cursor = 0;
  zones.forEach((zone) => {
    out += html.slice(cursor, zone.contentStart) + rebuilt[zone.matched];
    cursor = zone.contentEnd;
  });

  const missed = changed.size - zones.length;
  if (missed > 0) {
    logger.warn(
      `[Translation] ${missed} composed block(s) not found in previewHtml: ` +
        'their preview keeps the source language.'
    );
  }
  return { html: out + html.slice(cursor), missed };
}

module.exports = { swapBuilderMarkup };
