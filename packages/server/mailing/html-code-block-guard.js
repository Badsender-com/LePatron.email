'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

// Server-side guards for "HTML code" blocks: their size, and whether the template
// allows them at all.
//
// Size: the editor already refuses to apply an oversized paste, but
// `mailing.data` is an unvalidated Mixed field, the body parser accepts 50MB, and
// `previewHtml` stores the rendered copy in the same document. Without this check
// a crafted or scripted request could push the document past Mongo's 16MB limit,
// which would surface as a raw Mongo error on save.
//
// Permission: the block DEFINITION is injected into every template client-side,
// whatever the flag (see packages/editor/src/js/ext/html-code-block/
// inject-html-code-block.js) — gating it would make checkModel splice stored
// blocks out of existing mailings. The flag only hides the palette entry, so on
// its own it stops nobody who writes the request by hand. This is where it holds.

// Keep in sync with packages/editor/src/js/ext/html-code-block/constants.js.
// Not imported from there: the editor package is a browser bundle, and the
// server must not depend on it. Enforced by
// tests/editor/html-code-block/constants-sync.test.js.
const HTML_CODE_BLOCK_TYPE = 'htmlCodeBlock';
const HTML_CODE_PROPERTY = 'htmlCode';
const HTML_CODE_MAX_LENGTH = 100000;

const isHtmlCodeBlock = (block) =>
  Boolean(block) && block.type === HTML_CODE_BLOCK_TYPE;

const htmlCodeOf = (block) =>
  typeof block[HTML_CODE_PROPERTY] === 'string'
    ? block[HTML_CODE_PROPERTY]
    : '';

/**
 * Every HTML code block of a Mosaico content model.
 *
 * Mosaico stores blocks in containers — `mainBlocks` by convention, but a
 * template may declare others — each a `{ blocks: [...] }` at the top level of
 * the model. Only that level is walked, so a deeply nested Mixed payload cannot
 * make this expensive, and a container other than `mainBlocks` cannot slip past.
 *
 * @param {Object} data mailing.data
 * @returns {Array<Object>}
 */
function findHtmlCodeBlocks(data) {
  if (!data || typeof data !== 'object') return [];

  return Object.values(data)
    .filter((value) => value && Array.isArray(value.blocks))
    .reduce((found, container) => found.concat(container.blocks), [])
    .filter(isHtmlCodeBlock);
}

/**
 * Length of the longest HTML code block in a Mosaico content model, or 0.
 *
 * @param {Object} data mailing.data
 * @returns {number}
 */
function findLongestHtmlCodeBlock(data) {
  return findHtmlCodeBlocks(data).reduce(
    (longest, block) => Math.max(longest, htmlCodeOf(block).length),
    0
  );
}

/**
 * @param {Object} data mailing.data
 * @param {number} [maxLength]
 * @returns {{ valid: boolean, length: number, maxLength: number }}
 */
function validateHtmlCodeBlocks(data, maxLength) {
  const limit =
    typeof maxLength === 'number' ? maxLength : HTML_CODE_MAX_LENGTH;
  const length = findLongestHtmlCodeBlock(data);
  return { valid: length <= limit, length, maxLength: limit };
}

/**
 * Whether `nextData` brings HTML code the template does not allow.
 *
 * With the flag on, anything goes. With it off, an HTML code block is refused
 * unless its markup is already stored on the mailing, word for word. That keeps
 * every existing mailing savable when a super admin turns the flag off after
 * blocks were written — refusing them would lock their authors out of their own
 * email — while nobody can add markup, or change it, through a template that does
 * not allow it. Moving, duplicating or deleting an existing block stays possible.
 *
 * An empty block is always accepted: it renders nothing and exports nothing.
 *
 * @param {Object} params
 * @param {Object} params.data the content about to be written
 * @param {Object} [params.previousData] the content currently stored
 * @param {boolean} params.htmlBlockEnabled the template flag
 * @returns {boolean}
 */
function bringsDisallowedHtmlCode({ data, previousData, htmlBlockEnabled }) {
  if (htmlBlockEnabled) return false;

  const stored = new Set(findHtmlCodeBlocks(previousData).map(htmlCodeOf));

  return findHtmlCodeBlocks(data).some((block) => {
    const html = htmlCodeOf(block);
    return html !== '' && !stored.has(html);
  });
}

/**
 * Throws when `data` brings HTML code the template does not allow.
 *
 * @param {Object} params see bringsDisallowedHtmlCode
 * @throws {Forbidden} HTML_CODE_BLOCK_DISABLED
 */
function assertHtmlCodeAllowed(params) {
  if (bringsDisallowedHtmlCode(params)) {
    throw new Forbidden(ERROR_CODES.HTML_CODE_BLOCK_DISABLED);
  }
}

/**
 * The same rule for a personalized block, whose content is ONE block rather
 * than a content model. Personalized blocks are shared with the whole company
 * and inserted into other people's mailings, so they get the same gate.
 *
 * @param {Object} params
 * @param {Object} params.content the block about to be written
 * @param {Object} [params.previousContent] the block currently stored
 * @param {boolean} params.htmlBlockEnabled the flag of the block's template
 * @throws {Forbidden} HTML_CODE_BLOCK_DISABLED
 */
function assertHtmlCodeBlockContentAllowed({
  content,
  previousContent,
  htmlBlockEnabled,
}) {
  const asModel = (block) => ({ blocks: { blocks: block ? [block] : [] } });
  assertHtmlCodeAllowed({
    data: asModel(content),
    previousData: asModel(previousContent),
    htmlBlockEnabled,
  });
}

/**
 * Whether a content model, or a single block, holds any HTML code block. Lets
 * callers skip loading the template flag when there is nothing to check.
 *
 * @param {Object} data mailing.data, or one block
 * @returns {boolean}
 */
function hasHtmlCodeBlock(data) {
  return isHtmlCodeBlock(data) || findHtmlCodeBlocks(data).length > 0;
}

module.exports = {
  validateHtmlCodeBlocks,
  findLongestHtmlCodeBlock,
  findHtmlCodeBlocks,
  bringsDisallowedHtmlCode,
  assertHtmlCodeAllowed,
  assertHtmlCodeBlockContentAllowed,
  hasHtmlCodeBlock,
  HTML_CODE_MAX_LENGTH,
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
};
