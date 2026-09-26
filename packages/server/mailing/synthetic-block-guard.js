'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

// Server-side guards for the synthetic blocks — the "HTML code" block and the
// block builder: their size, and whether the template allows them at all.
//
// Size: the editor already refuses to apply an oversized paste, but
// `mailing.data` is an unvalidated Mixed field, the body parser accepts 50MB, and
// `previewHtml` stores the rendered copy in the same document. Without this check
// a crafted or scripted request could push the document past Mongo's 16MB limit,
// which would surface as a raw Mongo error on save.
//
// Permission: the block DEFINITIONS are injected into every template
// client-side, whatever the flags (see packages/editor/src/js/ext/
// html-code-block/inject-synthetic-blocks.js) — gating them would make
// checkModel splice stored blocks out of existing mailings. The flags only hide
// the palette entries, so on their own they stop nobody who writes the request
// by hand. This is where they hold.
//
// The two blocks are gated INDEPENDENTLY. A client can be given the builder
// without the raw HTML block, which is exactly the client who wants the guard
// rails, so one flag must never stand in for the other.

// Keep in sync with packages/editor/src/js/ext/html-code-block/block-types.js.
// Not imported from there: the editor package is a browser bundle, and the
// server must not depend on it. Enforced by
// tests/editor/html-code-block/constants-sync.test.js.
const SYNTHETIC_BLOCKS = Object.freeze([
  Object.freeze({
    type: 'htmlCodeBlock',
    htmlProperty: 'htmlCode',
    flag: 'htmlBlockEnabled',
    errorCode: ERROR_CODES.HTML_CODE_BLOCK_DISABLED,
  }),
  Object.freeze({
    type: 'blockBuilderBlock',
    htmlProperty: 'builderHtml',
    flag: 'blockBuilderEnabled',
    errorCode: ERROR_CODES.BLOCK_BUILDER_DISABLED,
  }),
]);

// The projection to pass to `Templates.findById(...).select(...)`: every flag
// this module reads, and nothing else.
const TEMPLATE_FLAG_PROJECTION = Object.freeze(
  SYNTHETIC_BLOCKS.reduce((projection, block) => {
    projection[block.flag] = 1;
    return projection;
  }, {})
);

const HTML_CODE_MAX_LENGTH = 100000;

const descriptorOf = (block) =>
  block && typeof block === 'object'
    ? SYNTHETIC_BLOCKS.find((candidate) => candidate.type === block.type) ||
      null
    : null;

const isSyntheticBlock = (block) => descriptorOf(block) !== null;

/**
 * The raw markup a synthetic block holds, whoever wrote it.
 *
 * @param {Object} block
 * @returns {string}
 */
function htmlOf(block) {
  const descriptor = descriptorOf(block);
  if (!descriptor) return '';
  const html = block[descriptor.htmlProperty];
  return typeof html === 'string' ? html : '';
}

/**
 * Every synthetic block of a Mosaico content model.
 *
 * Mosaico stores blocks in containers — `mainBlocks` by convention, but a
 * template may declare others — each a `{ blocks: [...] }` at the top level of
 * the model. Only that level is walked, so a deeply nested Mixed payload cannot
 * make this expensive, and a container other than `mainBlocks` cannot slip past.
 *
 * @param {Object} data mailing.data
 * @returns {Array<Object>}
 */
function findSyntheticBlocks(data) {
  if (!data || typeof data !== 'object') return [];

  return Object.values(data)
    .filter((value) => value && Array.isArray(value.blocks))
    .reduce((found, container) => found.concat(container.blocks), [])
    .filter(isSyntheticBlock);
}

/**
 * Length of the longest synthetic block in a Mosaico content model, or 0.
 *
 * @param {Object} data mailing.data
 * @returns {number}
 */
function findLongestSyntheticBlock(data) {
  return findSyntheticBlocks(data).reduce(
    (longest, block) => Math.max(longest, htmlOf(block).length),
    0
  );
}

/**
 * @param {Object} data mailing.data
 * @param {number} [maxLength]
 * @returns {{ valid: boolean, length: number, maxLength: number }}
 */
function validateSyntheticBlocks(data, maxLength) {
  const limit =
    typeof maxLength === 'number' ? maxLength : HTML_CODE_MAX_LENGTH;
  const length = findLongestSyntheticBlock(data);
  return { valid: length <= limit, length, maxLength: limit };
}

/**
 * The descriptor of the first block `data` brings that its flag disallows, or
 * null.
 *
 * With a flag on, anything of that type goes. With it off, such a block is
 * refused unless its markup is already stored on the mailing, word for word.
 * That keeps every existing mailing savable when a super admin turns a flag off
 * after blocks were written — refusing them would lock their authors out of
 * their own email — while nobody can add markup, or change it, through a
 * template that does not allow it. Moving, duplicating or deleting an existing
 * block stays possible.
 *
 * An empty block is always accepted: it renders nothing and exports nothing.
 *
 * Comparison is per TYPE, not across types: markup already stored in an HTML
 * code block must not make the same markup acceptable in a builder block whose
 * flag is off.
 *
 * @param {Object} params
 * @param {Object} params.data the content about to be written
 * @param {Object} [params.previousData] the content currently stored
 * @param {Object} params.flags the template flags, by name
 * @returns {Object|null}
 */
function findDisallowedSyntheticBlock({ data, previousData, flags }) {
  const allowed = flags || {};

  const storedByType = findSyntheticBlocks(previousData).reduce(
    (byType, block) => {
      if (!byType[block.type]) byType[block.type] = new Set();
      byType[block.type].add(htmlOf(block));
      return byType;
    },
    {}
  );

  const offending = findSyntheticBlocks(data).find((block) => {
    const descriptor = descriptorOf(block);
    if (allowed[descriptor.flag]) return false;

    const html = htmlOf(block);
    if (html === '') return false;

    const stored = storedByType[block.type];
    return !stored || !stored.has(html);
  });

  return offending ? descriptorOf(offending) : null;
}

/**
 * Whether `data` brings markup a template flag disallows.
 *
 * @param {Object} params see findDisallowedSyntheticBlock
 * @returns {boolean}
 */
function bringsDisallowedSyntheticHtml(params) {
  return findDisallowedSyntheticBlock(params) !== null;
}

/**
 * Throws when `data` brings markup a template flag disallows.
 *
 * The error names the block that was refused, so a client given the builder but
 * not the raw HTML block is not told the builder is disabled.
 *
 * @param {Object} params see findDisallowedSyntheticBlock
 * @throws {Forbidden}
 */
function assertSyntheticHtmlAllowed(params) {
  const refused = findDisallowedSyntheticBlock(params);
  if (refused) throw new Forbidden(refused.errorCode);
}

/**
 * The same rule for a personalized block, whose content is ONE block rather
 * than a content model. Personalized blocks are shared with the whole company
 * and inserted into other people's mailings, so they get the same gate.
 *
 * @param {Object} params
 * @param {Object} params.content the block about to be written
 * @param {Object} [params.previousContent] the block currently stored
 * @param {Object} params.flags the flags of the block's template
 * @throws {Forbidden}
 */
function assertSyntheticBlockContentAllowed({
  content,
  previousContent,
  flags,
}) {
  const asModel = (block) => ({ blocks: { blocks: block ? [block] : [] } });
  assertSyntheticHtmlAllowed({
    data: asModel(content),
    previousData: asModel(previousContent),
    flags,
  });
}

/**
 * Whether a content model, or a single block, holds any synthetic block. Lets
 * callers skip loading the template flags when there is nothing to check.
 *
 * @param {Object} data mailing.data, or one block
 * @returns {boolean}
 */
function hasSyntheticBlock(data) {
  return isSyntheticBlock(data) || findSyntheticBlocks(data).length > 0;
}

module.exports = {
  validateSyntheticBlocks,
  findLongestSyntheticBlock,
  findSyntheticBlocks,
  findDisallowedSyntheticBlock,
  bringsDisallowedSyntheticHtml,
  assertSyntheticHtmlAllowed,
  assertSyntheticBlockContentAllowed,
  hasSyntheticBlock,
  SYNTHETIC_BLOCKS,
  TEMPLATE_FLAG_PROJECTION,
  HTML_CODE_MAX_LENGTH,
};
