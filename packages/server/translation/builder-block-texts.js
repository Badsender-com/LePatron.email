'use strict';

const { generate } = require('../../shared/block-builder/generate.js');
const {
  parseState,
  serialiseState,
} = require('../../shared/block-builder/state.js');
const { elementFor } = require('../../shared/block-builder/elements/index.js');
const { isTranslatableValue } = require('./mosaico-text-extractor.js');
const { BLOCK_BUILDER_BLOCK } = require('../../shared/synthetic-blocks.js');
const {
  HTML_CODE_MAX_LENGTH,
  locateSyntheticBlocks,
} = require('../mailing/synthetic-block-guard.js');

// Translation for the block builder.
//
// The generic extractor walks `mailing.data` and picks string fields whose NAME
// looks translatable. A composed block defeats it completely: everything the
// user wrote is inside `builderState`, which is one long JSON **string** — a
// field whose name matches nothing and whose value is not prose. So a mailing
// with composed blocks came back from translation with those blocks still in
// the source language, silently.
//
// This is the pass that fixes it, and it is the reason the generator is a
// shared module rather than editor code. Translating a composed block is not
// "translate these strings": the stored HTML has to be REBUILT from the
// translated state, or `builderHtml` stays in the old language while the state
// moves on. Same generator, same templates, same escaping as the editor — which
// is the only way the two can agree.
//
// What is NOT touched: `builderHtml` is never sent anywhere. It is regenerated,
// never translated. Sending generated markup to an LLM would have it rewritten,
// and the block's whole promise is that Badsender owns that HTML.

// Keys are namespaced so the generic injector cannot mistake one for a path
// into the model — it would walk into a string and fail. They are split back out
// before it ever sees them (see splitBuilderTranslations).
const BUILDER_KEY_PREFIX = 'builderBlock';

// Read from the table the editor writes the block from, so a renamed property
// cannot leave this pass reading a field nobody writes any more.
const {
  type: BLOCK_BUILDER_TYPE,
  stateProperty: STATE_PROPERTY,
  htmlProperty: HTML_PROPERTY,
} = BLOCK_BUILDER_BLOCK;

const INDEX = /^\d+$/;

const keyFor = (container, blockIndex, elementIndex, field) =>
  `${BUILDER_KEY_PREFIX}.${container}.${blockIndex}.${elementIndex}.${field}`;

/**
 * Every composed block of a content model, with where it sits — the same walk
 * as the save guard's (see locateSyntheticBlocks).
 *
 * @param {Object} data mailing.data
 * @returns {Array<{container: string, index: number, block: Object}>}
 */
function findBuilderBlocks(data) {
  return locateSyntheticBlocks(data).filter(
    ({ block }) => block.type === BLOCK_BUILDER_TYPE
  );
}

/**
 * The translatable texts of every composed block.
 *
 * Which fields count is decided by the element's own manifest, not by its
 * field names: TEXT and RICH_TEXT slots, and the ATTR slots declared
 * translatable (an image `alt`) — see translatableOf in
 * packages/shared/block-builder/manifest.js. A URL, a colour or a size is
 * never sent, whatever it is called. The value filter is still the generic
 * extractor's, so an empty text or a bare variable stays home.
 *
 * @param {Object} data mailing.data
 * @returns {Object} flat map of key -> text
 */
function extractBuilderTexts(data) {
  const result = {};

  findBuilderBlocks(data).forEach(({ container, index, block }) => {
    const state = parseState(block[STATE_PROPERTY]);
    if (!state) return;

    state.elements.forEach((element, elementIndex) => {
      // parseState drops an element of unknown type, so the definition exists.
      elementFor(element.type).translatable.forEach((field) => {
        const value = element[field];
        if (!isTranslatableValue(value)) return;
        result[keyFor(container, index, elementIndex, field)] = value;
      });
    });
  });

  return result;
}

/**
 * Splits a translations map into the builder's keys and everyone else's.
 *
 * The generic injector resolves a key as a dot path into the model. A builder
 * key is not one — it would walk into `data.builderBlock`, find nothing, and be
 * counted as a failed injection, which turns a working translation into a
 * warning nobody can act on.
 *
 * @param {Object} translations
 * @returns {{ builder: Object, rest: Object }}
 */
function splitBuilderTranslations(translations) {
  const builder = {};
  const rest = {};

  Object.entries(translations || {}).forEach(([key, value]) => {
    if (key.startsWith(`${BUILDER_KEY_PREFIX}.`)) builder[key] = value;
    else rest[key] = value;
  });

  return { builder, rest };
}

/**
 * `builderBlock.mainBlocks.0.2.content` -> its parts, or null.
 *
 * Returned rather than thrown: a key that does not parse comes from a provider
 * that invented one, and dropping it is better than failing a whole mailing's
 * translation over a single line.
 */
function parseKey(key) {
  const parts = key.split('.');
  if (parts.length !== 5 || parts[0] !== BUILDER_KEY_PREFIX) return null;

  const [, container, blockIndex, elementIndex, field] = parts;
  // Digits only: `Number('')` is 0, so a key with an empty segment would
  // otherwise land on the first block or element.
  if (!container || !field) return null;
  if (!INDEX.test(blockIndex) || !INDEX.test(elementIndex)) return null;

  return {
    container,
    blockIndex: Number(blockIndex),
    elementIndex: Number(elementIndex),
    field,
  };
}

/**
 * A composed block's state, parsed once, and whether its stored markup is what
 * the current generator makes of it.
 *
 * It is not when the block was applied with another generator version: the
 * markup is frozen when written (see generate.js), and the rebuild below will
 * follow the current templates rather than the ones the client approved. The
 * block is still translated — refusing it would leave it in the source
 * language for a difference nobody can act on — but it is counted, so the
 * user is told to check it.
 */
function readBlock(block) {
  const state = parseState(block[STATE_PROPERTY]);
  const outdated = state !== null && generate(state) !== block[HTML_PROPERTY];
  return { block, state, outdated };
}

/**
 * Writes each translation into its block's parsed state.
 *
 * @returns {{ states: Map, applied: number, skipped: string[] }}
 */
function applyToStates(data, entries) {
  const blocks = new Map(
    findBuilderBlocks(data).map(({ container, index, block }) => [
      `${container}.${index}`,
      block,
    ])
  );
  const states = new Map();
  const skipped = [];
  let applied = 0;

  entries.forEach(([key, value]) => {
    const parsed = parseKey(key);
    const id = parsed && `${parsed.container}.${parsed.blockIndex}`;
    const block = id && blocks.get(id);
    if (!block || typeof value !== 'string') {
      skipped.push(key);
      return;
    }

    if (!states.has(id)) states.set(id, readBlock(block));
    const { state } = states.get(id);
    const element = state && state.elements[parsed.elementIndex];
    // Only a field the extraction could have sent: one of the element's
    // translatable slots (see extractBuilderTexts), held by the element itself.
    // A translation never writes a link, a colour or a size.
    const writable =
      element &&
      elementFor(element.type).translatable.includes(parsed.field) &&
      Object.prototype.hasOwnProperty.call(element, parsed.field);
    if (!writable) {
      skipped.push(key);
      return;
    }

    element[parsed.field] = value;
    applied += 1;
  });

  return { states, applied, skipped };
}

/**
 * Regenerates one block from its translated state.
 *
 * @returns {'updated'|'oversized'|'unchanged'}
 */
function rebuildBlock({ block, state }) {
  if (!state) return 'unchanged';

  const serialised = serialiseState(state);
  // An empty string means the state would not serialise. Defensive: a state
  // that came back from `parseState` is plain JSON and cannot be cyclic, so
  // there is no honest test for this. Writing '' would lose the composition;
  // leaving both fields as they were keeps the block untranslated but intact,
  // which is the recoverable failure.
  if (serialised === '') return 'unchanged';

  const markup = generate(state);
  if (markup.length > HTML_CODE_MAX_LENGTH) return 'oversized';

  block[STATE_PROPERTY] = serialised;
  block[HTML_PROPERTY] = markup;
  return 'updated';
}

/**
 * Writes translations back, and REBUILDS the markup from the result.
 *
 * Regenerating is the whole point. Translating the state and leaving
 * `builderHtml` alone would ship an email whose stored HTML is still in the
 * source language while its state says otherwise — the two would disagree
 * forever, and the next person to reopen the block would silently "fix" it.
 *
 * Mutates `data` in place: the caller already works on a clone (the generic
 * injector deep-clones before it starts).
 *
 * A block whose rebuilt markup would blow past the size the save route
 * enforces is left exactly as it was. That route never sees this write — the
 * translated copy is persisted by `duplicateWithTranslatedData` — so the limit
 * has to hold here too, and the value it bounds now comes from a provider's
 * response rather than from something a user typed in the editor. `previewHtml`
 * stores a second copy in the same document, against Mongo's 16MB per-document
 * ceiling.
 *
 * Refusing the block rather than the whole translation, and refusing rather
 * than truncating: a block left in the source language is visible and
 * recoverable, and half a table is not.
 *
 * @param {Object} data mailing.data
 * @param {Object} translations builder keys only
 * @returns {{ blocksUpdated: number, applied: number, skipped: string[],
 *   oversized: number, outdated: number }} `outdated` counts the blocks whose
 *   stored markup another generator version wrote (see readBlock)
 */
function injectBuilderTexts(data, translations) {
  const entries = Object.entries(translations || {});
  const { states, applied, skipped } = applyToStates(data, entries);

  const result = {
    blocksUpdated: 0,
    applied,
    skipped,
    oversized: 0,
    outdated: 0,
  };
  states.forEach((entry) => {
    if (entry.outdated) result.outdated += 1;
    const outcome = rebuildBlock(entry);
    if (outcome === 'updated') result.blocksUpdated += 1;
    if (outcome === 'oversized') result.oversized += 1;
  });

  return result;
}

module.exports = {
  extractBuilderTexts,
  splitBuilderTranslations,
  injectBuilderTexts,
  findBuilderBlocks,
  BUILDER_KEY_PREFIX,
};
