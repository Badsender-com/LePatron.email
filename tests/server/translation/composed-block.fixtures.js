'use strict';

// Composed blocks for the translation tests, stored the way the editor stores
// them: the state serialised, and the markup generated from it on apply
// (block-builder-modal.js handleApply).

const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  elementFor,
} = require('../../../packages/shared/block-builder/elements/index.js');

/** A composed block holding `elements`. */
function composedBlock(elements) {
  const state = { ...emptyState(), elements };
  return {
    type: 'blockBuilderBlock',
    builderState: serialiseState(state),
    builderHtml: generate(state),
  };
}

// An element as the editor creates it from its defaults (element-list.js),
// then edited.
const element = (id, type, values) => ({
  id,
  type,
  ...elementFor(type).defaults,
  ...values,
});

// Bare elements, for the tests that only care about one field.
const text = (content, overrides) => ({
  id: 'e1',
  type: 'text',
  content,
  ...overrides,
});
const button = (label) => ({ id: 'e2', type: 'button', label, href: '#' });
const image = (alt) => ({ id: 'e3', type: 'image', alt, src: '', href: '' });

const modelWith = (...blocks) => ({ mainBlocks: { blocks } });

module.exports = { composedBlock, element, text, button, image, modelWith };
