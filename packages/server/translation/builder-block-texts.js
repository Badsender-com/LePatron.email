'use strict';

const {
  generate,
  ELEMENT_ATTRIBUTE,
} = require('../../shared/block-builder/generate.js');
const {
  parseState,
  serialiseState,
} = require('../../shared/block-builder/state.js');
const {
  isTranslatableFieldName,
  isTranslatableValue,
} = require('./mosaico-text-extractor.js');
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
 * Which fields count is decided by the SAME predicates the generic extractor
 * uses, deliberately: `content`, `label` and `alt` are picked up because they
 * match `/content$/i`, `/label$/i` and `/alt$/i` there too. A sixth element
 * shipping a `caption` would be translated without anyone editing this file,
 * and a field the generic pass refuses — a colour, a number — is refused here
 * for the same reason.
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
      Object.entries(element).forEach(([field, value]) => {
        if (field === 'id' || field === 'type') return;
        if (!isTranslatableFieldName(field)) return;
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
  const block = Number(blockIndex);
  const element = Number(elementIndex);
  if (!Number.isInteger(block) || !Number.isInteger(element)) return null;

  return { container, blockIndex: block, elementIndex: element, field };
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
 *   oversized: number }}
 */
function injectBuilderTexts(data, translations) {
  const entries = Object.entries(translations || {});
  const skipped = [];
  let oversized = 0;
  if (entries.length === 0) {
    return { blocksUpdated: 0, applied: 0, skipped, oversized };
  }

  // Parse each block's state once, apply everything, then regenerate once.
  const states = new Map();
  const blocks = new Map(
    findBuilderBlocks(data).map(({ container, index, block }) => [
      `${container}.${index}`,
      block,
    ])
  );

  let applied = 0;

  entries.forEach(([key, value]) => {
    const parsed = parseKey(key);
    if (!parsed || typeof value !== 'string') {
      skipped.push(key);
      return;
    }

    const id = `${parsed.container}.${parsed.blockIndex}`;
    const block = blocks.get(id);
    if (!block) {
      skipped.push(key);
      return;
    }

    if (!states.has(id))
      states.set(id, { block, state: parseState(block[STATE_PROPERTY]) });

    const { state } = states.get(id);
    const element = state && state.elements[parsed.elementIndex];
    // The field must already exist. A translation that invents one would add a
    // key the element's template never renders, and `cleanElement` would drop
    // it on the next load anyway.
    if (!element || !(parsed.field in element)) {
      skipped.push(key);
      return;
    }

    element[parsed.field] = value;
    applied += 1;
  });

  let blocksUpdated = 0;
  states.forEach(({ block, state }) => {
    if (!state) return;

    const serialised = serialiseState(state);
    // An empty string means the state would not serialise. Defensive: a state
    // that came back from `parseState` is plain JSON and cannot be cyclic, so
    // there is no honest test for this. Writing '' would lose the composition;
    // leaving both fields as they were keeps the block untranslated but intact,
    // which is the recoverable failure.
    if (serialised === '') return;

    const markup = generate(state);
    if (markup.length > HTML_CODE_MAX_LENGTH) {
      oversized += 1;
      return;
    }

    block[STATE_PROPERTY] = serialised;
    block[HTML_PROPERTY] = markup;
    blocksUpdated += 1;
  });

  return { blocksUpdated, applied, skipped, oversized };
}

/**
 * The markup every composed block should now show, in document order.
 *
 * Handed to the preview updater, which swaps each zone: a composed block's
 * markup is protected from the string replacement that translates the rest of
 * previewHtml — as it must be, it is generated — so the only way it changes
 * language is by being replaced wholesale.
 *
 * @param {Object} data mailing.data, already translated
 * @returns {string[]}
 */
function builderMarkups(data) {
  return findBuilderBlocks(data).map(({ block }) => block[HTML_PROPERTY] || '');
}

module.exports = {
  extractBuilderTexts,
  splitBuilderTranslations,
  injectBuilderTexts,
  builderMarkups,
  findBuilderBlocks,
  BUILDER_KEY_PREFIX,
  ELEMENT_ATTRIBUTE,
};
