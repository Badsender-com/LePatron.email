'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger.js');
const { SYNTHETIC_BLOCKS } = require('../../shared/synthetic-blocks.js');

// Keeps the markup of the synthetic blocks — the "HTML code" block and the
// block builder — out of the passes that rewrite previewHtml after a
// translation: the string replacement and the sanitizer.
//
// mailing.data is already safe: the extractor excludes every descriptor's
// markup and state properties (EXCLUDED_FIELDS in mosaico-text-extractor.js),
// so neither block's markup is ever offered for translation. But previewHtml is
// translated by blind string replacement (preview-html-updater.js), which
// happily rewrites text that happens to sit inside a block's markup. The
// preview and the multi-mailing ZIP (both reading previewHtml) then diverged
// from the editor export (regenerated from data) — two different deliverables
// for one mailing.
//
// What happens to a zone next depends on its block. An HTML code block is
// never translated: its zone comes out of every pass as it went in. A composed
// block is translated through its state (builder-block-texts.js): its zone is
// kept out of the string replacement here, then swapped for the markup rebuilt
// from the translated state (builder-preview-swap.js).
//
// Locating a zone, in order of reliability:
//   1. the markup stored on the block, when the caller has it: the editor export
//      substitutes it back byte for byte right after the marker element opens, so
//      it can be matched EXACTLY, whatever it contains — an extra `</div>`, a
//      `<div` inside a script string, anything pasted;
//   2. otherwise, depth-counting `<div>` from the marker element, skipping HTML
//      comments so a conditional comment cannot unbalance the count.
//
// Everything here is a linear scan. A regex matching the marker's opening tag
// with a lookahead over its attributes (`<div(?=[^>]*class=...)`) backtracked
// quadratically on crafted input — seconds of blocked event loop per 100KB.

// Both synthetic blocks are protected, and their marker classes come from the
// table the editor export emits them from (packages/shared/synthetic-blocks.js).
// The builder's markup carries no ESP script to lose, but its zones must be
// recognised all the same: an unrecognised zone would be translated by blind
// string replacement, and the preview would drift from the export.
const MARKER_CLASSES = SYNTHETIC_BLOCKS.map((block) => block.markerClass);

// A candidate opening tag longer than this is not LePatron's marker element,
// whose attributes are a class and, at most, an id.
const MAX_TAG_LENGTH = 4096;

// How many of the stored blocks, in order, a zone is compared against.
const EXACT_MATCH_LOOKAHEAD = 8;

const DIV_OPEN = /<div\s/gi;
const DIV_OR_COMMENT = /<!--|-->|<div\b|<\/div\s*>/gi;

/**
 * The marker class an opening tag carries, as a whole token, or null:
 * `lp-html-block-root` (the block root) and `not-lp-html-block-either` are not
 * the marker.
 */
function markerClassOf(tag) {
  const classAttr = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
  if (!classAttr) return null;
  const classes = (classAttr[1] || classAttr[2] || '').split(/\s+/);
  return MARKER_CLASSES.find((marker) => classes.includes(marker)) || null;
}

/**
 * Opening tags of marker elements, in document order:
 * `{ start, contentStart, markerClass }`.
 *
 * Linear: every candidate `<div ` is read up to the next `>`, and the scan
 * resumes after that `>` — nothing in between can open a real tag, since the
 * serialized template escapes `<` in text. Each character is read once.
 */
function findMarkerTags(html) {
  const tags = [];
  DIV_OPEN.lastIndex = 0;
  let open;
  while ((open = DIV_OPEN.exec(html))) {
    const start = open.index;
    const close = html.indexOf('>', start);
    if (close === -1) break;
    const contentStart = close + 1;
    DIV_OPEN.lastIndex = contentStart;
    if (contentStart - start > MAX_TAG_LENGTH) continue;
    const markerClass = markerClassOf(html.slice(start, contentStart));
    if (markerClass) tags.push({ start, contentStart, markerClass });
  }
  return tags;
}

/**
 * Where the element whose content starts at `contentStart` closes:
 * `{ contentEnd, end }` around its `</div>`, or null when the markup is
 * unbalanced.
 */
function findMatchingClose(html, contentStart) {
  DIV_OR_COMMENT.lastIndex = contentStart;
  let depth = 1;
  let inComment = false;
  let token;
  while ((token = DIV_OR_COMMENT.exec(html))) {
    const value = token[0].toLowerCase();
    if (inComment) {
      if (value === '-->') inComment = false;
      continue;
    }
    if (value === '<!--') {
      inComment = true;
    } else if (value === '<div') {
      depth += 1;
    } else if (value.startsWith('</div')) {
      depth -= 1;
      if (depth === 0) {
        return { contentEnd: token.index, end: token.index + token[0].length };
      }
    }
  }
  return null;
}

/**
 * The zone opened at `tag`, when one of the `remaining` stored markups sits
 * exactly at the start of its content: `{ contentEnd, end, matched }`, where
 * `matched` is that markup's index in the caller's list. It is removed from
 * `remaining`, so two identical blocks match in turn. Null when none does.
 */
function exactZone(html, tag, remaining) {
  // Blocks render in the order they are stored, so the match is almost always
  // the first one left. Looking a few further tolerates a template whose
  // containers render in another order, without comparing every tag against
  // every block.
  const found = remaining
    .slice(0, EXACT_MATCH_LOOKAHEAD)
    .findIndex(({ raw }) => html.startsWith(raw, tag.contentStart));
  if (found === -1) return null;

  const { raw, index } = remaining[found];
  remaining.splice(found, 1);
  const contentEnd = tag.contentStart + raw.length;

  // The marker element's own closing tag follows the markup.
  const close = /^<\/div\s*>/i.exec(html.slice(contentEnd, contentEnd + 16));
  const end = close ? contentEnd + close[0].length : contentEnd;
  return { contentEnd, end, matched: index };
}

/**
 * The zones of `html` that belong to a synthetic block, in document order.
 *
 * Each zone gives the range of the marker element (`start`, `end`, what the
 * string replacement and the sanitizer keep out) and of its content
 * (`contentStart`, `contentEnd`, the block's markup itself, which is what the
 * composed-block swap replaces). `matched` is the index, in `htmlCodes`, of the
 * stored markup the zone was matched on exactly, or -1 when it was located by
 * counting `<div>`.
 *
 * @param {string} html
 * @param {string[]} [htmlCodes] the markup stored in the mailing's synthetic
 *   blocks, in document order. When given, each zone is matched on it exactly.
 * @returns {Array<{start: number, end: number, contentStart: number,
 *   contentEnd: number, matched: number, markerClass: string}>}
 */
function findHtmlCodeBlockRanges(html, htmlCodes) {
  const ranges = [];
  if (!html || typeof html !== 'string') return ranges;

  // Empty blocks render no zone at all, and '' would match anywhere.
  const remaining = (htmlCodes || [])
    .map((raw, index) => ({ raw, index }))
    .filter(({ raw }) => typeof raw === 'string' && raw !== '');

  for (const tag of findMarkerTags(html)) {
    // A marker inside a zone already protected — pasted markup that happens to
    // carry the class — belongs to that zone.
    const previous = ranges[ranges.length - 1];
    if (previous && tag.start < previous.end) continue;

    const { start, contentStart, markerClass } = tag;
    const base = { start, contentStart, markerClass, matched: -1 };
    const zone =
      exactZone(html, tag, remaining) || findMatchingClose(html, contentStart);
    if (!zone) {
      // Unbalanced pasted markup. Protect to the end of the document rather than
      // risk rewriting inside it: a mailing whose tail is left untranslated is a
      // visible, recoverable problem; silently corrupted pasted HTML is not.
      logger.warn(
        '[Translation] unbalanced synthetic block markup in previewHtml, protecting to end of document',
        { markerClass }
      );
      ranges.push({ ...base, contentEnd: html.length, end: html.length });
      return ranges;
    }
    ranges.push({ ...base, ...zone });
  }
  return ranges;
}

/**
 * Apply `transform` to every part of `html` EXCEPT the synthetic block zones.
 *
 * @param {string} html
 * @param {Function} transform (segment: string) => string
 * @param {string[]} [htmlCodes] see findHtmlCodeBlockRanges
 * @returns {string}
 */
function transformOutsideHtmlCodeBlocks(html, transform, htmlCodes) {
  if (!html || typeof html !== 'string') return html;
  const ranges = findHtmlCodeBlockRanges(html, htmlCodes);
  if (ranges.length === 0) return transform(html);

  let result = '';
  let cursor = 0;
  for (const range of ranges) {
    result += transform(html.slice(cursor, range.start));
    result += html.slice(range.start, range.end);
    cursor = range.end;
  }
  result += transform(html.slice(cursor));
  return result;
}

/**
 * Apply a WHOLE-document transform — the sanitizer — to `html`, and put every
 * synthetic block zone back untouched afterwards.
 *
 * Unlike transformOutsideHtmlCodeBlocks, the transform needs the full document
 * to make sense of it, so each zone is swapped for an inert token first — ASCII,
 * no markup, which a sanitizer keeps as text — then restored. Same technique as
 * the editor export (packages/editor/src/js/ext/html-code-block/
 * export-substitution.js).
 *
 * Why: the translated copy's previewHtml is sanitized before storage, because
 * provider output was injected into it. Sanitizing the pasted markup along with
 * it stripped the ESP scripts the block exists for, and the copy's ZIP no longer
 * matched its export. An HTML code block's zone holds no provider output — it
 * is excluded from translation. A composed block's zone holds markup the
 * generator rebuilt from translated text, and relies on the generator's
 * escaping instead. The preview is sanitized again when served.
 *
 * Only a zone matched EXACTLY on a stored markup is kept out of the transform.
 * One located by counting `<div>` is only known to carry a marker class — which
 * any text written into the preview can carry too — so it is sanitized with
 * the rest. The string replacement keeps protecting both kinds: leaving a zone
 * untranslated is the safe side there, not here.
 *
 * @param {string} html
 * @param {Function} transform (document: string) => string
 * @param {string[]} [htmlCodes] see findHtmlCodeBlockRanges
 * @returns {string}
 */
function transformDocumentKeepingHtmlCodeBlocks(html, transform, htmlCodes) {
  if (!html || typeof html !== 'string') return transform(html);
  const ranges = findHtmlCodeBlockRanges(html, htmlCodes).filter(
    (range) => range.matched !== -1
  );
  if (ranges.length === 0) return transform(html);

  const nonce = crypto.randomBytes(8).toString('hex');
  const tokenFor = (index) => `LPHTMLBLOCK${nonce}X${index}X`;

  let withTokens = '';
  let cursor = 0;
  ranges.forEach((range, index) => {
    withTokens += html.slice(cursor, range.start) + tokenFor(index);
    cursor = range.end;
  });
  withTokens += html.slice(cursor);

  const transformed = transform(withTokens);
  const pattern = new RegExp(`LPHTMLBLOCK${nonce}X(\\d+)X`, 'g');
  // A replacer function, not a string: pasted markup routinely holds `$&`.
  return transformed.replace(pattern, (match, index) => {
    const range = ranges[Number(index)];
    return range ? html.slice(range.start, range.end) : '';
  });
}

module.exports = {
  transformOutsideHtmlCodeBlocks,
  transformDocumentKeepingHtmlCodeBlocks,
  findHtmlCodeBlockRanges,
  MARKER_CLASSES,
};
