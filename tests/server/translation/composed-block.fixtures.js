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

/**
 * A composed block stored in rows of columns, as the modal stores it since it
 * composes rows: no flat `elements` view, so the generator renders the rows.
 *
 * @param {Array<Array<Array<Object>>>} rows each row a list of columns, each
 *   column a list of elements; columns share the row's width evenly
 */
function rowsBlock(rows) {
  const { elements: _flatView, ...base } = emptyState();
  const state = {
    ...base,
    rows: rows.map((columns, rowIndex) => ({
      id: `row-${rowIndex + 1}`,
      columns: columns.map((elements) => ({
        width: 100 / columns.length,
        elements,
      })),
    })),
  };
  return {
    type: 'blockBuilderBlock',
    builderState: serialiseState(state),
    builderHtml: generate(state),
  };
}

const modelWith = (...blocks) => ({ mainBlocks: { blocks } });

module.exports = {
  composedBlock,
  rowsBlock,
  element,
  text,
  button,
  image,
  modelWith,
};
