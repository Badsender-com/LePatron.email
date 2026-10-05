'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const {
  SYNTHETIC_BLOCKS: SHARED_SYNTHETIC_BLOCKS,
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
} = require('../../shared/synthetic-blocks.js');

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

// The descriptors come from the table the editor injects from
// (packages/shared/synthetic-blocks.js), so the property read here is the one the
// editor writes and the flag is the one the palette obeys. What only the server
// knows is added here: the error codes naming each block when it is refused —
// for its flag, and for its size. A composer told their HTML code block is too
// large, when they have none, has nothing to act on.
const ERROR_CODES_BY_TYPE = Object.freeze({
  [HTML_CODE_BLOCK.type]: {
    errorCode: ERROR_CODES.HTML_CODE_BLOCK_DISABLED,
    tooLargeErrorCode: ERROR_CODES.HTML_CODE_BLOCK_TOO_LARGE,
  },
  [BLOCK_BUILDER_BLOCK.type]: {
    errorCode: ERROR_CODES.BLOCK_BUILDER_DISABLED,
    tooLargeErrorCode: ERROR_CODES.BLOCK_BUILDER_TOO_LARGE,
  },
});

const SYNTHETIC_BLOCKS = Object.freeze(
  SHARED_SYNTHETIC_BLOCKS.map((block) =>
    Object.freeze({ ...block, ...ERROR_CODES_BY_TYPE[block.type] })
  )
);

// The projection to pass to `Templates.findById(...).select(...)`: every flag
// this module reads, and nothing else.
const TEMPLATE_FLAG_PROJECTION = Object.freeze(
  SYNTHETIC_BLOCKS.reduce((projection, block) => {
    projection[block.flag] = 1;
    return projection;
  }, {})
);

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
 * Every synthetic block of a Mosaico content model, with where it sits.
 *
 * Mosaico stores blocks in containers — `mainBlocks` by convention, but a
 * template may declare others — each a `{ blocks: [...] }` at the top level of
 * the model. Only that level is walked, so a deeply nested Mixed payload cannot
 * make this expensive, and a container other than `mainBlocks` cannot slip past.
 *
 * The position is what the translation of composed blocks keys its texts on
 * (translation/builder-block-texts.js); one walk for both, so the guard and
 * the translation can never disagree on which blocks a mailing holds.
 *
 * @param {Object} data mailing.data
 * @returns {Array<{container: string, index: number, block: Object}>}
 */
function locateSyntheticBlocks(data) {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([, value]) => value && Array.isArray(value.blocks))
    .reduce((found, [container, value]) => {
      value.blocks.forEach((block, index) => {
        if (isSyntheticBlock(block)) found.push({ container, index, block });
      });
      return found;
    }, []);
}

/**
 * Every synthetic block of a Mosaico content model, in document order.
 *
 * @param {Object} data mailing.data
 * @returns {Array<Object>}
 */
function findSyntheticBlocks(data) {
  return locateSyntheticBlocks(data).map(({ block }) => block);
}

/**
 * One block — a personalized block's content — as a content model, so that
 * every walk, size and gate above applies to it unchanged.
 *
 * @param {Object} [block]
 * @returns {Object} a model holding `block`, or no block at all
 */
const asModel = (block) => ({ blocks: { blocks: block ? [block] : [] } });

/**
 * The serialised state a synthetic block stores next to its markup, or '' for
 * a block that keeps none.
 *
 * @param {Object} block
 * @returns {string}
 */
function stateOf(block) {
  const descriptor = descriptorOf(block);
  if (!descriptor || !descriptor.stateProperty) return '';
  const state = block[descriptor.stateProperty];
  return typeof state === 'string' ? state : '';
}

/**
 * What identifies a stored synthetic block: its markup AND its state. A
 * builder block's markup is rebuilt from its state (builder-block-integrity.js),
 * so stored markup next to another state is not the stored block. One key for
 * the guard and the rebuild, so they cannot disagree on what "already stored"
 * means. A NUL never appears in either half.
 *
 * @param {Object} block
 * @returns {string}
 */
const pairKeyOf = (block) => `${htmlOf(block)}\u0000${stateOf(block)}`;

/**
 * The descriptor of the first synthetic block past a size limit, or null.
 *
 * The markup is bounded for every block; the builder's state too, since it
 * sits in the same document and nothing else bounds it.
 *
 * @param {Object} data mailing.data
 * @param {Object} [limits]
 * @param {number} [limits.html] maximum markup length
 * @param {number} [limits.state] maximum serialised state length
 * @returns {Object|null}
 */
function findOversizedSyntheticBlock(data, limits) {
  const { html = HTML_CODE_MAX_LENGTH, state = BUILDER_STATE_MAX_LENGTH } =
    limits || {};
  const oversized = findSyntheticBlocks(data).find(
    (block) => htmlOf(block).length > html || stateOf(block).length > state
  );
  return oversized ? descriptorOf(oversized) : null;
}

/**
 * @param {Object} data mailing.data
 * @param {number} [maxLength] maximum markup length
 * @returns {{ valid: boolean, errorCode: string|null }} `errorCode` names the
 *   refused block — its markup or, for the builder, its state.
 */
function validateSyntheticBlocks(data, maxLength) {
  const limit =
    typeof maxLength === 'number' ? maxLength : HTML_CODE_MAX_LENGTH;
  const refused = findOversizedSyntheticBlock(data, { html: limit });
  return {
    valid: refused === null,
    errorCode: refused ? refused.tooLargeErrorCode : null,
  };
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
      byType[block.type].add(pairKeyOf(block));
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
    return !stored || !stored.has(pairKeyOf(block));
  });

  return offending ? descriptorOf(offending) : null;
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
  findOversizedSyntheticBlock,
  findSyntheticBlocks,
  locateSyntheticBlocks,
  findDisallowedSyntheticBlock,
  assertSyntheticHtmlAllowed,
  hasSyntheticBlock,
  asModel,
  pairKeyOf,
  htmlOf,
  SYNTHETIC_BLOCKS,
  TEMPLATE_FLAG_PROJECTION,
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
};
