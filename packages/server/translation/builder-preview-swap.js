'use strict';

// Putting a rebuilt composed block back into previewHtml.
//
// Its own file rather than sitting with the extraction and the injection,
// because it answers a different question: those decide what a block SAYS, this
// decides how the stored preview document is edited. It touches no state, no
// generator and no element — a string and two lists of markup go in, a string
// comes out.

/**
 * Swaps each composed block's old markup for its rebuilt one, in previewHtml.
 *
 * The preview is translated by replacing strings in the stored document, and
 * a composed block's markup is deliberately PROTECTED from that pass — it is
 * generated, and letting a string replacement loose inside it would corrupt
 * markup nobody typed. So the only way the preview changes language is by
 * having those zones replaced wholesale, which is what this does.
 *
 * Matched on the exact bytes the export put there, scanning forward so two
 * identical blocks are swapped in order rather than both taking the first
 * match. A zone that cannot be found is left alone: a preview that keeps one
 * block in the old language is a visible, recoverable problem, and rewriting
 * the wrong range would not be.
 *
 * @param {string} html previewHtml, already translated everywhere else
 * @param {string[]} before markup as stored before translation, in order
 * @param {string[]} after markup rebuilt from the translated state, in order
 * @returns {string}
 */
function swapBuilderMarkup(html, before, after) {
  if (!html || typeof html !== 'string') return html;

  let out = '';
  let cursor = 0;

  (before || []).forEach((old, index) => {
    const next = (after || [])[index];
    if (!old || typeof next !== 'string' || old === next) return;

    const at = html.indexOf(old, cursor);
    if (at === -1) return;

    out += html.slice(cursor, at) + next;
    cursor = at + old.length;
  });

  return out + html.slice(cursor);
}

module.exports = { swapBuilderMarkup };
